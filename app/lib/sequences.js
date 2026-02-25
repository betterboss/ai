// Sequence workflow engine - processes follow-up sequences
import { getSQL } from './db';
import { sendTemplatedEmail } from './email';
import { sendTemplatedSMS } from './sms';

// Process all due sequence steps
export async function processSequences() {
  const sql = getSQL();
  const results = { processed: 0, sent: 0, errors: 0, completed: 0 };

  // Find all enrollments with due actions
  const dueEnrollments = await sql`
    SELECT se.id, se.sequence_id, se.current_step, se.contact_email, se.contact_phone,
           se.contact_name, se.lead_id, se.job_id, se.user_id,
           s.name as sequence_name, s.is_active
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id
    WHERE se.status = 'active'
      AND se.next_run_at <= NOW()
      AND s.is_active = true
    ORDER BY se.next_run_at ASC
    LIMIT 100
  `;

  for (const enrollment of dueEnrollments) {
    results.processed++;

    try {
      // Get the current step
      const steps = await sql`
        SELECT id, step_order, delay_days, delay_hours, action_type, action_config, conditions
        FROM sequence_steps
        WHERE sequence_id = ${enrollment.sequence_id}
        ORDER BY step_order ASC
      `;

      const currentStep = steps[enrollment.current_step];
      if (!currentStep) {
        // No more steps — complete the enrollment
        await sql`
          UPDATE sequence_enrollments
          SET status = 'completed', completed_at = NOW()
          WHERE id = ${enrollment.id}
        `;
        results.completed++;
        continue;
      }

      // Check conditions
      if (currentStep.conditions) {
        const shouldSkip = await checkConditions(sql, enrollment, currentStep.conditions);
        if (shouldSkip) {
          await advanceToNextStep(sql, enrollment, steps);
          continue;
        }
      }

      // Execute the action
      const actionResult = await executeAction(sql, enrollment, currentStep);

      // Log the action
      await sql`
        INSERT INTO sequence_logs (enrollment_id, step_index, channel, content, subject, status, sent_at)
        VALUES (${enrollment.id}, ${enrollment.current_step}, ${currentStep.action_type},
                ${actionResult.content || ''}, ${actionResult.subject || ''},
                ${actionResult.success ? 'sent' : 'failed'}, NOW())
      `;

      if (actionResult.success) {
        results.sent++;
      } else {
        results.errors++;
      }

      // Advance to next step
      await advanceToNextStep(sql, enrollment, steps);

    } catch (error) {
      console.error(`Error processing enrollment ${enrollment.id}:`, error);
      results.errors++;
    }
  }

  return results;
}

// Execute a single sequence action
async function executeAction(sql, enrollment, step) {
  const config = step.action_config || {};
  const variables = {
    client_name: enrollment.contact_name || 'there',
    contact_name: enrollment.contact_name || 'there',
    company_name: '', // TODO: load from user settings
    job_name: enrollment.job_id || '',
  };

  switch (step.action_type) {
    case 'email': {
      if (!enrollment.contact_email) {
        return { success: false, error: 'No email address', content: '' };
      }

      // Load template if specified
      let subject = config.subject || 'Follow-up';
      let body = config.message || config.body || '';

      if (config.template_id) {
        const templates = await sql`
          SELECT subject, body FROM message_templates WHERE id = ${config.template_id}
        `;
        if (templates[0]) {
          subject = templates[0].subject;
          body = templates[0].body;
        }
      }

      const result = await sendTemplatedEmail({
        to: enrollment.contact_email,
        subject,
        body,
        variables,
      });

      return { ...result, content: body, subject };
    }

    case 'sms': {
      if (!enrollment.contact_phone) {
        return { success: false, error: 'No phone number', content: '' };
      }

      let body = config.message || config.body || '';

      if (config.template_id) {
        const templates = await sql`
          SELECT body FROM message_templates WHERE id = ${config.template_id}
        `;
        if (templates[0]) {
          body = templates[0].body;
        }
      }

      const result = await sendTemplatedSMS({
        to: enrollment.contact_phone,
        body,
        variables,
      });

      return { ...result, content: body };
    }

    case 'notification': {
      // Internal notification — log it
      return { success: true, content: config.message || 'Notification triggered' };
    }

    default:
      return { success: false, error: `Unknown action type: ${step.action_type}`, content: '' };
  }
}

// Check if conditions mean we should skip this step
async function checkConditions(sql, enrollment, conditions) {
  if (conditions.skip_if_status && enrollment.lead_id) {
    const leads = await sql`
      SELECT status FROM leads WHERE id = ${enrollment.lead_id}
    `;
    if (leads[0]?.status === conditions.skip_if_status) {
      return true;
    }
  }

  if (conditions.skip_if === 'replied') {
    // Check if the contact has replied (look for recent sequence logs with 'replied' status)
    const replied = await sql`
      SELECT id FROM sequence_logs
      WHERE enrollment_id = ${enrollment.id} AND status = 'replied'
      LIMIT 1
    `;
    if (replied.length > 0) return true;
  }

  return false;
}

// Advance enrollment to the next step
async function advanceToNextStep(sql, enrollment, steps) {
  const nextStepIndex = enrollment.current_step + 1;

  if (nextStepIndex >= steps.length) {
    // Sequence complete
    await sql`
      UPDATE sequence_enrollments
      SET status = 'completed', current_step = ${nextStepIndex}, completed_at = NOW()
      WHERE id = ${enrollment.id}
    `;
    return;
  }

  const nextStep = steps[nextStepIndex];
  const delayMs = ((nextStep.delay_days || 0) * 86400000) + ((nextStep.delay_hours || 0) * 3600000);
  const nextRunAt = new Date(Date.now() + delayMs);

  await sql`
    UPDATE sequence_enrollments
    SET current_step = ${nextStepIndex}, next_run_at = ${nextRunAt}
    WHERE id = ${enrollment.id}
  `;
}

// Enroll a contact into a sequence
export async function enrollInSequence(sql, { sequenceId, userId, contactName, contactEmail, contactPhone, leadId, jobId }) {
  // Check if already enrolled in this sequence
  const existing = await sql`
    SELECT id FROM sequence_enrollments
    WHERE sequence_id = ${sequenceId}
      AND (lead_id = ${leadId || null} OR contact_email = ${contactEmail || null})
      AND status = 'active'
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { success: false, error: 'Already enrolled in this sequence' };
  }

  // Get the first step to determine initial delay
  const steps = await sql`
    SELECT delay_days, delay_hours FROM sequence_steps
    WHERE sequence_id = ${sequenceId}
    ORDER BY step_order ASC
    LIMIT 1
  `;

  const firstStep = steps[0];
  const delayMs = firstStep
    ? ((firstStep.delay_days || 0) * 86400000) + ((firstStep.delay_hours || 0) * 3600000)
    : 0;
  const nextRunAt = new Date(Date.now() + delayMs);

  const rows = await sql`
    INSERT INTO sequence_enrollments (sequence_id, user_id, contact_name, contact_email, contact_phone, lead_id, job_id, next_run_at)
    VALUES (${sequenceId}, ${userId}, ${contactName || null}, ${contactEmail || null}, ${contactPhone || null}, ${leadId || null}, ${jobId || null}, ${nextRunAt})
    RETURNING id, status, next_run_at
  `;

  return { success: true, enrollment: rows[0] };
}
