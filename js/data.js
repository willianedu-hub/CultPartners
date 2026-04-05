// ============================================================
//  data.js — Todas as chamadas ao Supabase centralizadas
//  Nenhum outro módulo chama sb.from() diretamente
// ============================================================

const DB = {

  // ── Auth ─────────────────────────────────────────────────

  async loginAdmin(login, senha) {
    const { data, error } = await sb.rpc('fn_login_admin', {
      p_login: login,
      p_senha: senha,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  async loginParceiro(login, senha) {
    const { data, error } = await sb.rpc('fn_login_parceiro', {
      p_login: login,
      p_senha: senha,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  // ── Base data (carregado uma vez no boot) ────────────────

  async loadStatusList() {
    const { data, error } = await sb
      .from('status_funil')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (error) throw error;
    return data || [];
  },

  async loadPartners() {
    const { data, error } = await sb
      .from('parceiros')
      .select('id, nome, cnpj, site, login, email, ativo')
      .is('deleted_at', null)
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  async loadProducts() {
    const { data, error } = await sb
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  // ── Oportunidades ────────────────────────────────────────

  async loadOpps(parceiroId = null) {
    // Usa a VIEW v_oportunidades que já traz dados desnormalizados
    let q = sb
      .from('v_oportunidades')
      .select('*')
      .order('created_at', { ascending: false });
    if (parceiroId) q = q.eq('parceiro_id', parceiroId);
    const { data, error } = await q;
    if (error) throw error;
    // Carrega tarefas de cada oportunidade
    const ids = (data || []).map(o => o.id);
    let tarefas = [];
    if (ids.length) {
      const { data: td, error: te } = await sb
        .from('tarefas')
        .select('*')
        .in('oportunidade_id', ids)
        .order('created_at');
      if (te) throw te;
      tarefas = td || [];
    }
    // Injeta tarefas em cada oportunidade
    return (data || []).map(o => ({
      ...o,
      tarefas: tarefas.filter(t => t.oportunidade_id === o.id),
    }));
  },

  async createOpp(payload) {
    const { data, error } = await sb
      .from('oportunidades')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data;
  },

  async updateOpp(id, payload) {
    const { error } = await sb
      .from('oportunidades')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },

  async approveOpp(id, adminId) {
    const { error } = await sb
      .from('oportunidades')
      .update({
        aprovacao:   'Aprovado',
        approved_at: new Date().toISOString(),
        approved_by: adminId,
        motivo_rejeicao: null,
        rejected_at:     null,
        rejected_by:     null,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async rejectOpp(id, adminId, motivo) {
    const { error } = await sb
      .from('oportunidades')
      .update({
        aprovacao:       'Rejeitado',
        motivo_rejeicao: motivo,
        rejected_at:     new Date().toISOString(),
        rejected_by:     adminId,
      })
      .eq('id', id);
    if (error) throw error;
  },

  // Soft delete via function do banco
  async deleteOpp(id, usuario) {
    const { error } = await sb.rpc('fn_delete_oportunidade', {
      p_id:      id,
      p_usuario: usuario,
    });
    if (error) throw error;
  },

  // Move status no kanban
  async moveOppStatus(id, statusId) {
    const { error } = await sb
      .from('oportunidades')
      .update({ status_id: statusId })
      .eq('id', id);
    if (error) throw error;
  },

  // Verifica duplicata (usa índice de texto)
  async checkDuplicate(empresa, cnpj, excludeId = null) {
    let q = sb
      .from('oportunidades')
      .select('id, empresa, cnpj, parceiro_id')
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    if (!data) return null;
    return data.find(o => {
      const matchE = empresa && o.empresa.toLowerCase() === empresa.toLowerCase();
      const matchC = cnpj?.length >= 14 && (o.cnpj || '').replace(/\D/g, '') === cnpj;
      return matchE || matchC;
    }) || null;
  },

  // ── Tarefas ──────────────────────────────────────────────

  async saveTasks(oppId, tasks) {
    // Estratégia: upsert das existentes (com id numérico) + insert das novas
    const existing = tasks.filter(t => typeof t.id === 'number');
    const newTasks = tasks.filter(t => typeof t.id !== 'number');

    // Apaga as que foram removidas
    const { data: dbTasks } = await sb
      .from('tarefas')
      .select('id')
      .eq('oportunidade_id', oppId);

    const dbIds  = (dbTasks || []).map(t => t.id);
    const keepIds = existing.map(t => t.id);
    const toDelete = dbIds.filter(id => !keepIds.includes(id));

    if (toDelete.length) {
      await sb.from('tarefas').delete().in('id', toDelete);
    }
    // Atualiza existentes
    for (const t of existing) {
      await sb.from('tarefas').update({
        descricao:   t.descricao,
        prazo:       t.prazo || null,
        responsavel: t.responsavel || null,
        concluida:   t.concluida || false,
      }).eq('id', t.id);
    }
    // Insere novas
    if (newTasks.length) {
      await sb.from('tarefas').insert(
        newTasks.map(t => ({
          oportunidade_id: oppId,
          descricao:       t.descricao,
          prazo:           t.prazo || null,
          responsavel:     t.responsavel || null,
          concluida:       false,
        }))
      );
    }
  },

  // ── Parceiros (admin CRUD) ───────────────────────────────

  async createPartner(payload) {
    // Cria sem senha — chama fn_set_senha_parceiro logo depois
    const { data, error } = await sb
      .from('parceiros')
      .insert({
        nome:       payload.nome,
        cnpj:       payload.cnpj || null,
        site:       payload.site || null,
        login:      payload.login,
        senha_hash: 'PLACEHOLDER', // será sobrescrito abaixo
        email:      payload.email || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    // Hash da senha via RPC (pgcrypto no banco)
    await sb.rpc('fn_set_senha_parceiro', {
      p_id:    data.id,
      p_senha: payload.senha,
    });
    return data;
  },

  async updatePartner(id, payload) {
    const update = {
      nome:  payload.nome,
      cnpj:  payload.cnpj  || null,
      site:  payload.site  || null,
      login: payload.login,
      email: payload.email || null,
    };
    const { error } = await sb.from('parceiros').update(update).eq('id', id);
    if (error) throw error;
    if (payload.senha) {
      await sb.rpc('fn_set_senha_parceiro', { p_id: id, p_senha: payload.senha });
    }
  },

  async softDeletePartner(id) {
    const { error } = await sb
      .from('parceiros')
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Status (admin CRUD) ──────────────────────────────────

  async createStatus(payload) {
    const { error } = await sb.from('status_funil').insert(payload);
    if (error) throw error;
  },

  async deleteStatus(id) {
    const { error } = await sb.from('status_funil').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  // ── Produtos (admin CRUD) ────────────────────────────────

  async createProduct(payload) {
    const { error } = await sb.from('produtos').insert(payload);
    if (error) throw error;
  },

  async deleteProduct(id) {
    const { error } = await sb.from('produtos').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  // ── Senha ────────────────────────────────────────────────

  async changePassword(role, id, nova) {
    const fn = role === 'admin' ? 'fn_set_senha_admin' : 'fn_set_senha_parceiro';
    const { error } = await sb.rpc(fn, { p_id: id, p_senha: nova });
    if (error) throw error;
  },

  // ── Audit Log ────────────────────────────────────────────

  async loadAuditLog() {
    const { data, error } = await sb
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw error;
    return data || [];
  },

  // ── Preferências de colunas ──────────────────────────────

  async loadColPrefs(userKey) {
    try {
      const { data } = await sb
        .from('preferencias_usuario')
        .select('colunas')
        .eq('user_key', userKey)
        .single();
      return data?.colunas || null;
    } catch {
      return null;
    }
  },

  async saveColPrefs(userKey, cols) {
    await sb.from('preferencias_usuario').upsert(
      { user_key: userKey, colunas: cols },
      { onConflict: 'user_key' }
    );
  },

};
