
class SupabaseAdapter {
  constructor(client) {
    this.client = client;
  }

  async saveLead(lead) {
    const user = (await this.client.auth.getUser()).data.user;
    if (!user) return;

    return this.client.from('leads').upsert({
      id: lead.id,
      user_id: user.id,
      company_name: lead.companyName || lead.nome || '',
      phone: lead.phone || '',
      instagram: lead.instagram || '',
      website: lead.website || '',
      status: lead.status || 'nao_enviada',
      pipeline_status: lead.pipelineStatus || 'contato_enviado'
    });
  }
}
window.SupabaseAdapter = SupabaseAdapter;
