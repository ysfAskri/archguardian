/**
 * Self-contained HTML template for the Architecture Guardian dashboard.
 * Returns a complete HTML page with inline CSS and JavaScript.
 */
export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architecture Guardian — Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f9fafb;
      color: #1f2937;
      line-height: 1.6;
    }

    header {
      background: #6366f1;
      color: #fff;
      padding: 1.5rem 2rem;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    }

    header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    header p {
      font-size: 0.875rem;
      opacity: 0.85;
      margin-top: 0.25rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Summary cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
    }

    .card-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .card-value {
      font-size: 2rem;
      font-weight: 700;
      color: #6366f1;
    }

    .card-value.trend-up { color: #ef4444; }
    .card-value.trend-down { color: #22c55e; }
    .card-value.trend-stable { color: #6b7280; }

    /* Chart section */
    .chart-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
      margin-bottom: 2rem;
    }

    .chart-section h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #374151;
    }

    .chart-container {
      width: 100%;
      overflow-x: auto;
    }

    .chart-container svg {
      display: block;
    }

    /* Table section */
    .table-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
    }

    .table-section h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #374151;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 2px solid #e5e7eb;
      color: #6b7280;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f3f4f6;
    }

    tr:hover td {
      background: #f9fafb;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-error { background: #fef2f2; color: #dc2626; }
    .badge-warning { background: #fffbeb; color: #d97706; }
    .badge-ok { background: #f0fdf4; color: #16a34a; }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #9ca3af;
    }

    .empty-state p {
      font-size: 1.125rem;
      margin-bottom: 0.5rem;
    }

    .loading {
      text-align: center;
      padding: 4rem 2rem;
      color: #6366f1;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>Architecture Guardian &mdash; Dashboard</h1>
    <p>Metrics over time from scan and check runs</p>
  </header>

  <div class="container" id="app">
    <div class="loading" id="loading">Loading metrics...</div>
  </div>

  <script>
    (function() {
      "use strict";

      function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function formatTimestamp(ts) {
        return ts.replace("T", " ").replace(/\\.\\d+Z$/, "").substring(0, 19);
      }

      function formatDuration(ms) {
        if (ms < 1000) return ms + "ms";
        return (ms / 1000).toFixed(1) + "s";
      }

      function computeTrend(entries) {
        if (entries.length < 2) return "stable";
        var mid = Math.floor(entries.length / 2);
        var firstHalf = entries.slice(0, mid);
        var secondHalf = entries.slice(mid);
        var avgFirst = firstHalf.reduce(function(s, e) { return s + e.totalFindings; }, 0) / firstHalf.length;
        var avgSecond = secondHalf.reduce(function(s, e) { return s + e.totalFindings; }, 0) / secondHalf.length;
        var diff = avgSecond - avgFirst;
        if (diff > 0.5) return "up";
        if (diff < -0.5) return "down";
        return "stable";
      }

      function trendSymbol(trend) {
        if (trend === "up") return "\\u2191 Increasing";
        if (trend === "down") return "\\u2193 Decreasing";
        return "= Stable";
      }

      function trendClass(trend) {
        if (trend === "up") return "trend-up";
        if (trend === "down") return "trend-down";
        return "trend-stable";
      }

      function renderCards(entries) {
        var totalRuns = entries.length;
        var latest = entries.length > 0 ? entries[entries.length - 1] : null;
        var latestFindings = latest ? latest.totalFindings : 0;
        var trend = computeTrend(entries);
        var avgDuration = entries.length > 0
          ? Math.round(entries.reduce(function(s, e) { return s + e.duration; }, 0) / entries.length)
          : 0;

        return '<div class="cards">'
          + '<div class="card"><div class="card-label">Total Runs</div><div class="card-value">' + totalRuns + '</div></div>'
          + '<div class="card"><div class="card-label">Latest Findings</div><div class="card-value">' + latestFindings + '</div></div>'
          + '<div class="card"><div class="card-label">Trend</div><div class="card-value ' + trendClass(trend) + '">' + trendSymbol(trend) + '</div></div>'
          + '<div class="card"><div class="card-label">Avg Duration</div><div class="card-value">' + formatDuration(avgDuration) + '</div></div>'
          + '</div>';
      }

      function renderChart(entries) {
        var chartEntries = entries.slice(-20);
        if (chartEntries.length < 2) {
          return '<div class="chart-section"><h2>Findings Over Time</h2><p style="color:#9ca3af;padding:2rem 0;text-align:center;">Need at least 2 runs to draw a chart.</p></div>';
        }

        var width = 800;
        var height = 300;
        var padLeft = 60;
        var padRight = 20;
        var padTop = 20;
        var padBottom = 40;
        var chartW = width - padLeft - padRight;
        var chartH = height - padTop - padBottom;

        var values = chartEntries.map(function(e) { return e.totalFindings; });
        var maxVal = Math.max.apply(null, values);
        if (maxVal === 0) maxVal = 1;

        var points = [];
        for (var i = 0; i < chartEntries.length; i++) {
          var x = padLeft + (i / (chartEntries.length - 1)) * chartW;
          var y = padTop + chartH - (values[i] / maxVal) * chartH;
          points.push(x.toFixed(1) + "," + y.toFixed(1));
        }

        var polyline = points.join(" ");

        // Build Y-axis labels
        var yLabels = "";
        var ySteps = 5;
        for (var s = 0; s <= ySteps; s++) {
          var yVal = Math.round((maxVal / ySteps) * s);
          var yPos = padTop + chartH - (s / ySteps) * chartH;
          yLabels += '<text x="' + (padLeft - 10) + '" y="' + (yPos + 4) + '" text-anchor="end" fill="#9ca3af" font-size="11">' + yVal + '</text>';
          yLabels += '<line x1="' + padLeft + '" y1="' + yPos + '" x2="' + (width - padRight) + '" y2="' + yPos + '" stroke="#f3f4f6" stroke-width="1"/>';
        }

        // Build X-axis labels (show every few)
        var xLabels = "";
        var step = Math.max(1, Math.floor(chartEntries.length / 6));
        for (var j = 0; j < chartEntries.length; j += step) {
          var xPos = padLeft + (j / (chartEntries.length - 1)) * chartW;
          var label = formatTimestamp(chartEntries[j].timestamp).substring(5, 16);
          xLabels += '<text x="' + xPos + '" y="' + (height - 5) + '" text-anchor="middle" fill="#9ca3af" font-size="10">' + escapeHtml(label) + '</text>';
        }

        // Dots
        var dots = "";
        for (var d = 0; d < points.length; d++) {
          var coords = points[d].split(",");
          dots += '<circle cx="' + coords[0] + '" cy="' + coords[1] + '" r="3.5" fill="#6366f1"/>';
        }

        // Area fill
        var areaPoints = padLeft.toFixed(1) + "," + (padTop + chartH).toFixed(1) + " " + polyline + " " + (padLeft + chartW).toFixed(1) + "," + (padTop + chartH).toFixed(1);

        var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
          + yLabels
          + xLabels
          + '<polygon points="' + areaPoints + '" fill="rgba(99,102,241,0.08)"/>'
          + '<polyline points="' + polyline + '" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
          + dots
          + '</svg>';

        return '<div class="chart-section"><h2>Findings Over Time (Last 20 Runs)</h2><div class="chart-container">' + svg + '</div></div>';
      }

      function renderTable(entries) {
        var recent = entries.slice(-10).reverse();

        var rows = "";
        for (var i = 0; i < recent.length; i++) {
          var e = recent[i];
          var errorBadge = e.errors > 0
            ? '<span class="badge badge-error">' + e.errors + '</span>'
            : '<span class="badge badge-ok">' + e.errors + '</span>';
          var warnBadge = e.warnings > 0
            ? '<span class="badge badge-warning">' + e.warnings + '</span>'
            : '<span class="badge badge-ok">' + e.warnings + '</span>';

          rows += "<tr>"
            + "<td>" + escapeHtml(formatTimestamp(e.timestamp)) + "</td>"
            + "<td>" + escapeHtml(e.command) + "</td>"
            + "<td>" + e.totalFiles + "</td>"
            + "<td>" + e.totalFindings + "</td>"
            + "<td>" + errorBadge + "</td>"
            + "<td>" + warnBadge + "</td>"
            + "<td>" + formatDuration(e.duration) + "</td>"
            + "</tr>";
        }

        return '<div class="table-section">'
          + '<h2>Recent Runs</h2>'
          + '<table>'
          + '<thead><tr><th>Timestamp</th><th>Command</th><th>Files</th><th>Findings</th><th>Errors</th><th>Warnings</th><th>Duration</th></tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '</table></div>';
      }

      function render(entries) {
        var app = document.getElementById("app");
        if (!app) return;

        if (!entries || entries.length === 0) {
          app.innerHTML = '<div class="empty-state"><p>No metrics recorded yet.</p><p style="font-size:0.875rem">Run <code>archguardian scan</code> or <code>archguardian check</code> first.</p></div>';
          return;
        }

        app.innerHTML = renderCards(entries) + renderChart(entries) + renderTable(entries);
      }

      function load() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/metrics", true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              try {
                var data = JSON.parse(xhr.responseText);
                render(data);
              } catch (e) {
                render([]);
              }
            } else {
              render([]);
            }
          }
        };
        xhr.send();
      }

      load();
    })();
  </script>
</body>
</html>`;
}
