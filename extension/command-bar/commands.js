// Command registry for the Better Boss command bar
// Each command defines an action that can be triggered from Ctrl+K

export const COMMAND_CATEGORIES = {
  jobtread: { label: 'JobTread', icon: '🏗️' },
  ai: { label: 'AI Tools', icon: '🤖' },
  nav: { label: 'Navigation', icon: '🧭' },
};

export const COMMANDS = [
  // JobTread actions
  {
    id: 'search_jobs',
    category: 'jobtread',
    icon: '🔍',
    label: 'Search Jobs',
    description: 'Find a job by name, number, or keyword',
    keywords: ['find', 'lookup', 'job', 'project'],
  },
  {
    id: 'search_contacts',
    category: 'jobtread',
    icon: '👤',
    label: 'Search Contacts',
    description: 'Find a contact by name or company',
    keywords: ['find', 'lookup', 'contact', 'customer', 'client', 'vendor'],
  },
  {
    id: 'create_job',
    category: 'jobtread',
    icon: '➕',
    label: 'Create Job',
    description: 'Create a new job in JobTread',
    keywords: ['new', 'add', 'job', 'project'],
  },
  {
    id: 'create_contact',
    category: 'jobtread',
    icon: '👤',
    label: 'Create Contact',
    description: 'Add a new contact to JobTread',
    keywords: ['new', 'add', 'contact', 'customer', 'client'],
  },
  {
    id: 'pipeline',
    category: 'jobtread',
    icon: '📊',
    label: 'Pipeline Summary',
    description: 'View your sales pipeline at a glance',
    keywords: ['pipeline', 'sales', 'overview', 'stage'],
  },

  // AI Tools
  {
    id: 'new_estimate',
    category: 'ai',
    icon: '📝',
    label: 'New AI Estimate',
    description: 'Create an estimate from a scope of work',
    keywords: ['estimate', 'scope', 'bid', 'quote'],
  },
  {
    id: 'write_proposal',
    category: 'ai',
    icon: '📄',
    label: 'Write Proposal',
    description: 'Generate a proposal from an estimate',
    keywords: ['proposal', 'write', 'generate', 'document'],
  },
  {
    id: 'write_email',
    category: 'ai',
    icon: '📨',
    label: 'Write Email',
    description: 'AI-generate a customer email',
    keywords: ['email', 'write', 'follow-up', 'message'],
  },
  {
    id: 'voice_command',
    category: 'ai',
    icon: '🎤',
    label: 'Voice Command',
    description: 'Talk to JobTread with your voice',
    keywords: ['voice', 'speak', 'talk', 'microphone'],
  },
  {
    id: 'ai_chat',
    category: 'ai',
    icon: '🤖',
    label: 'AI Agent Chat',
    description: 'Chat with the Better Boss AI agent',
    keywords: ['chat', 'agent', 'ai', 'assistant', 'help'],
  },

  // Navigation
  {
    id: 'nav_dashboard',
    category: 'nav',
    icon: '📊',
    label: 'Dashboard',
    description: 'View business analytics dashboard',
    keywords: ['dashboard', 'analytics', 'metrics', 'overview'],
  },
  {
    id: 'nav_leads',
    category: 'nav',
    icon: '📋',
    label: 'Leads',
    description: 'View and manage captured leads',
    keywords: ['leads', 'prospects', 'capture'],
  },
  {
    id: 'nav_sequences',
    category: 'nav',
    icon: '🔔',
    label: 'Sequences',
    description: 'Manage follow-up sequences',
    keywords: ['sequences', 'automation', 'follow-up', 'nurture'],
  },
  {
    id: 'nav_daily_logs',
    category: 'nav',
    icon: '📓',
    label: 'Daily Logs',
    description: 'View and create daily job logs',
    keywords: ['daily', 'log', 'report', 'journal'],
  },
  {
    id: 'nav_change_orders',
    category: 'nav',
    icon: '📋',
    label: 'Change Orders',
    description: 'Manage change orders',
    keywords: ['change', 'order', 'CO', 'modification'],
  },
];

// Search/filter commands by query
export function filterCommands(query) {
  if (!query) return COMMANDS;
  const lower = query.toLowerCase();
  return COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(lower) ||
    cmd.description.toLowerCase().includes(lower) ||
    cmd.keywords.some(k => k.includes(lower))
  );
}
