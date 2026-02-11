// File generation utilities — CSV, reports, downloads

export class FileUtils {
  // Convert array of objects to CSV string
  static toCSV(data, columns) {
    if (!data || data.length === 0) return '';

    // Resolve nested keys like "customer.name"
    const getValue = (obj, key) => {
      return key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), obj);
    };

    // Use provided columns or auto-detect from first object
    const cols = columns || Object.keys(data[0]);

    // Header row
    const header = cols.map(c => `"${c}"`).join(',');

    // Data rows
    const rows = data.map(item =>
      cols.map(col => {
        const val = getValue(item, col);
        // Escape quotes and wrap in quotes
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  // Download a string as a file
  static download(content, filename, mimeType = 'text/csv') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Use chrome.downloads API
    chrome.downloads.download({
      url,
      filename,
      saveAs: true,
    }, () => {
      URL.revokeObjectURL(url);
    });
  }

  // Download CSV from skill result
  static downloadCSV(result) {
    const csv = this.toCSV(result.data, result.columns);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `jobtread-${result.type}-${timestamp}.csv`;
    this.download(csv, filename);
    return { success: true, filename, rowCount: result.data.length };
  }

  // Generate a formatted report string
  static generateReport(result) {
    if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
      return 'No data to report.';
    }

    let report = `# ${result.title}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (Array.isArray(result.data)) {
      report += `Total records: ${result.data.length}\n\n`;

      // Table header
      const cols = result.columns || Object.keys(result.data[0]);
      report += '| ' + cols.join(' | ') + ' |\n';
      report += '| ' + cols.map(() => '---').join(' | ') + ' |\n';

      // Table rows
      const getValue = (obj, key) =>
        key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : '—'), obj);

      for (const item of result.data) {
        report += '| ' + cols.map(c => String(getValue(item, c))).join(' | ') + ' |\n';
      }
    } else {
      // Single object — key/value format
      for (const [key, val] of Object.entries(result.data)) {
        if (typeof val === 'object' && val !== null) {
          report += `\n## ${key}\n`;
          for (const [k, v] of Object.entries(val)) {
            report += `- **${k}**: ${v}\n`;
          }
        } else {
          report += `- **${key}**: ${val}\n`;
        }
      }
    }

    return report;
  }

  // Download report as text file
  static downloadReport(result) {
    const report = this.generateReport(result);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `jobtread-${result.type}-report-${timestamp}.md`;
    this.download(report, filename, 'text/markdown');
    return { success: true, filename };
  }
}
