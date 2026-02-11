// Skills engine — maps skill triggers to JobTread API actions

export class Skills {
  constructor(jobtreadApi) {
    this.jt = jobtreadApi;
  }

  async execute(skill, param) {
    const handler = this.handlers[skill];
    if (!handler) return { error: `Unknown skill: ${skill}` };

    try {
      return await handler.call(this, param);
    } catch (err) {
      return { error: err.message, skill };
    }
  }

  handlers = {
    // ── Search ────────────────────────────────────────────

    async SEARCH_PROJECTS(query) {
      const data = await this.jt.searchProjects(query);
      const projects = (data.jobs?.edges || []).map(e => e.node);
      return {
        type: 'projects',
        title: `Projects matching "${query}"`,
        data: projects,
        count: projects.length,
        columns: ['name', 'number', 'status', 'customer.name', 'totalPrice'],
      };
    },

    async SEARCH_CONTACTS(query) {
      const data = await this.jt.searchContacts(query);
      const contacts = (data.contacts?.edges || []).map(e => e.node);
      return {
        type: 'contacts',
        title: `Contacts matching "${query}"`,
        data: contacts,
        count: contacts.length,
        columns: ['name', 'email', 'phone', 'company', 'type'],
      };
    },

    async SEARCH_CATALOG(query) {
      const data = await this.jt.searchCatalog(query);
      const items = (data.catalogItems?.edges || []).map(e => e.node);
      return {
        type: 'catalog',
        title: `Catalog items matching "${query}"`,
        data: items,
        count: items.length,
        columns: ['name', 'unitPrice', 'unitCost', 'unit', 'category'],
      };
    },

    // ── Detail Views ──────────────────────────────────────

    async GET_PROJECT(id) {
      const data = await this.jt.getProject(id);
      return {
        type: 'project_detail',
        title: `Project: ${data.job?.name}`,
        data: data.job,
      };
    },

    async GET_CONTACT(id) {
      const data = await this.jt.getContact(id);
      return {
        type: 'contact_detail',
        title: `Contact: ${data.contact?.name}`,
        data: data.contact,
      };
    },

    async GET_ESTIMATES(jobId) {
      const data = await this.jt.getEstimates(jobId);
      const estimates = (data.estimates?.edges || []).map(e => e.node);
      return {
        type: 'estimates',
        title: 'Estimates',
        data: estimates,
        count: estimates.length,
        columns: ['name', 'status', 'totalPrice', 'totalCost', 'createdAt'],
      };
    },

    async GET_INVOICES(jobId) {
      const data = await this.jt.getInvoices(jobId);
      const invoices = (data.invoices?.edges || []).map(e => e.node);
      return {
        type: 'invoices',
        title: 'Invoices',
        data: invoices,
        count: invoices.length,
        columns: ['number', 'status', 'totalAmount', 'paidAmount', 'dueDate'],
      };
    },

    async GET_TASKS(jobId) {
      const data = await this.jt.getTasks(jobId);
      const tasks = (data.tasks?.edges || []).map(e => e.node);
      return {
        type: 'tasks',
        title: 'Tasks',
        data: tasks,
        count: tasks.length,
        columns: ['name', 'status', 'dueDate', 'assignee.name'],
      };
    },

    async DASHBOARD() {
      const data = await this.jt.getDashboardStats();
      return {
        type: 'dashboard',
        title: 'Dashboard Stats',
        data: {
          activeJobs: data.activeJobs?.totalCount || 0,
          pendingEstimates: data.pendingEstimates?.totalCount || 0,
          unpaidInvoices: data.unpaidInvoices?.totalCount || 0,
        },
      };
    },

    // ── Memory ────────────────────────────────────────────

    async SAVE_MEMORY(param) {
      // param format: "key:value"
      const colonIdx = param.indexOf(':');
      if (colonIdx === -1) return { error: 'Invalid format. Use key:value' };
      const key = param.slice(0, colonIdx).trim();
      const value = param.slice(colonIdx + 1).trim();
      // Memory.saveNote is called from background.js
      return { type: 'memory_save', key, value };
    },

    // ── CSV Export ────────────────────────────────────────

    async EXPORT_CSV(type) {
      // Fetch data based on type, then convert to CSV
      let result;
      switch (type) {
        case 'projects':
          result = await this.handlers.SEARCH_PROJECTS.call(this, '');
          break;
        case 'contacts':
          result = await this.handlers.SEARCH_CONTACTS.call(this, '');
          break;
        case 'catalog':
          result = await this.handlers.SEARCH_CATALOG.call(this, '');
          break;
        default:
          return { error: `Unknown export type: ${type}` };
      }
      return { ...result, exportAs: 'csv' };
    },

    async BOOK_CALL() {
      return {
        type: 'booking',
        url: 'https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call',
      };
    },
  };

  // Get list of available skills for display
  static list() {
    return [
      { id: 'SEARCH_PROJECTS', label: 'Search Projects', icon: '🏗️', description: 'Find projects by name, number, or customer' },
      { id: 'SEARCH_CONTACTS', label: 'Search Contacts', icon: '👥', description: 'Find contacts, customers, or vendors' },
      { id: 'SEARCH_CATALOG', label: 'Search Catalog', icon: '📦', description: 'Search your catalog items and pricing' },
      { id: 'DASHBOARD', label: 'Dashboard', icon: '📊', description: 'Quick stats: active jobs, pending estimates, invoices' },
      { id: 'EXPORT_CSV', label: 'Export CSV', icon: '📄', description: 'Export projects, contacts, or catalog to CSV' },
      { id: 'BOOK_CALL', label: 'Book Audit Call', icon: '📞', description: 'Schedule a FREE Growth Audit with Nick Peret' },
    ];
  }
}
