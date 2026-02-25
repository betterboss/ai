// AI Agent tool definitions for Claude's native tool_use feature
// Maps natural language → JobTread API operations

import * as jt from './jobtread';

// Tool definitions for Claude's tool_use API
export const TOOL_DEFINITIONS = [
  {
    name: 'search_jobs',
    description: 'Search for jobs in JobTread by name or keyword. Returns matching jobs with their ID, name, number, and status.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (job name, number, or keyword)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search for contacts (customers, vendors) in JobTread by name. Returns matching contacts with ID, name, email, and phone.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Contact name to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_job',
    description: 'Create a new job in JobTread. Optionally link to an existing contact and set a job address.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Job name (e.g., "Smith Kitchen Remodel")' },
        address: { type: 'string', description: 'Job site address' },
        contactId: { type: 'string', description: 'ID of existing contact to link (from search_contacts)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact (customer or vendor) in JobTread.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the contact' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        accountType: { type: 'string', enum: ['customer', 'vendor'], description: 'Contact type' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_job_details',
    description: 'Get full details of a specific job including contacts, documents, and status.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The JobTread job ID' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'update_job_status',
    description: 'Update the status of a job in JobTread.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The JobTread job ID to update' },
        status: { type: 'string', description: 'New status value' },
      },
      required: ['jobId', 'status'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment or note to a job in JobTread. Used for updates, daily logs, and general notes.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The JobTread job ID' },
        text: { type: 'string', description: 'The comment text to add' },
      },
      required: ['jobId', 'text'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the sales pipeline: total jobs, pipeline value, and jobs by stage.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_recent_jobs',
    description: 'Get recent jobs from the organization, optionally filtered by status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (optional)' },
        limit: { type: 'number', description: 'Number of jobs to return (default 20)' },
      },
    },
  },
  {
    name: 'get_invoices',
    description: 'Get invoices, optionally filtered by status. Useful for AR aging and accounting overview.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by invoice status (optional)' },
      },
    },
  },
];

// Execute a tool call — routes to the appropriate JobTread API function
export async function executeTool(grantKey, toolName, toolInput) {
  switch (toolName) {
    case 'search_jobs': {
      const jobs = await jt.searchJobs(grantKey, toolInput.query);
      return { jobs, count: jobs.length };
    }

    case 'search_contacts': {
      const contacts = await jt.searchContacts(grantKey, toolInput.query);
      return { contacts, count: contacts.length };
    }

    case 'create_job': {
      const job = await jt.createJob(grantKey, {
        name: toolInput.name,
        address: toolInput.address,
        contactId: toolInput.contactId,
      });
      return { job, message: `Created job "${job.name}" (#${job.number})` };
    }

    case 'create_contact': {
      const contact = await jt.createContact(grantKey, {
        name: toolInput.name,
        email: toolInput.email,
        phone: toolInput.phone,
        accountType: toolInput.accountType || 'customer',
      });
      return { contact, message: `Created contact "${contact.name}"` };
    }

    case 'get_job_details': {
      const job = await jt.getJobDetails(grantKey, toolInput.jobId);
      return { job };
    }

    case 'update_job_status': {
      const job = await jt.updateJob(grantKey, {
        jobId: toolInput.jobId,
        status: toolInput.status,
      });
      return { job, message: `Updated job status to "${toolInput.status}"` };
    }

    case 'add_comment': {
      const comment = await jt.addJobComment(grantKey, {
        jobId: toolInput.jobId,
        text: toolInput.text,
      });
      return { comment, message: 'Comment added successfully' };
    }

    case 'get_pipeline_summary': {
      const jobs = await jt.getOrganizationJobs(grantKey, { size: 200 });
      const stages = {};
      let totalValue = 0;

      for (const job of jobs) {
        const stageName = job.pipelineStage?.name || 'No Stage';
        if (!stages[stageName]) stages[stageName] = { count: 0, jobs: [] };
        stages[stageName].count++;
        stages[stageName].jobs.push({ id: job.id, name: job.name, number: job.number });
      }

      return {
        totalJobs: jobs.length,
        stages,
        summary: Object.entries(stages).map(([name, data]) => `${name}: ${data.count} jobs`).join(', '),
      };
    }

    case 'get_recent_jobs': {
      const jobs = toolInput.status
        ? await jt.getJobsByStatus(grantKey, { status: toolInput.status, size: toolInput.limit || 20 })
        : await jt.getOrganizationJobs(grantKey, { size: toolInput.limit || 20 });
      return { jobs, count: jobs.length };
    }

    case 'get_invoices': {
      const invoices = await jt.getInvoices(grantKey, { status: toolInput.status });
      return { invoices, count: invoices.length };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
