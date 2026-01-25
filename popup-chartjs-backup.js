let currentMode = 'overtime';
let parsedData = null;
let currentChart = null;

// Register Chart.js datalabels plugin
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// Mode toggle
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('downloadChart').style.display = 'none';
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }
  });
});

// Download chart button
document.getElementById('downloadChart').addEventListener('click', () => {
  if (!currentChart) return;
  
  // Create a high-resolution canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 3200;
  exportCanvas.height = 1800;
  
  const exportCtx = exportCanvas.getContext('2d');
  
  // Rebuild chart config manually to avoid circular references
  const chartData = {
    type: currentChart.config.type,
    data: currentChart.config.data,
    options: buildExportOptions(currentChart.config.type)
  };
  
  chartData.options.responsive = false;
  chartData.options.maintainAspectRatio = false;
  
  const exportChart = new Chart(exportCtx, chartData);
  
  setTimeout(() => {
    const url = exportCanvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `tokarank-${currentMode}-${Date.now()}.png`;
    link.href = url;
    link.click();
    
    exportChart.destroy();
  }, 500);
});

function buildExportOptions(chartType) {
  if (chartType === 'line') {
    return {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'AI Traffic Over Time',
          font: { size: 48 }
        },
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 18,
            boxHeight: 18,
            font: { size: 36 }
          }
        },
        datalabels: {
          align: 'top',
          anchor: 'end',
          formatter: (value) => value,
          color: '#333333',
          font: {
            weight: 'bold',
            size: 33
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            font: { size: 32 }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 500,
            font: { size: 32 }
          },
          grid: {
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      }
    };
  } else {
    // doughnut
    return {
      responsive: false,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: 'AI Traffic Breakdown by Source',
          font: { size: 48 }
        },
        legend: {
          display: false
        },
        datalabels: {
          color: '#ffffff',
          font: {
            weight: 'normal',
            size: 48
          },
          formatter: (value, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100);
            if (percentage < 5) return '';
            return percentage.toFixed(1) + '%';
          }
        }
      }
    };
  }
}

// Process data button
document.getElementById('processData').addEventListener('click', () => {
  const input = document.getElementById('dataInput').value.trim();

  if (!input) {
    alert('Please paste data first!');
    return;
  }

  try {
    if (currentMode === 'overtime') {
      parsedData = parseOverTimeData(input);
      createLineChart(parsedData);
    } else if (currentMode === 'breakdown') {
      parsedData = parseBreakdownData(input);
      createDoughnutChart(parsedData);
    }
  } catch (error) {
    console.error('Error processing data:', error);
    alert('Error processing data: ' + error.message);
  }
});

function parseOverTimeData(input) {
  const lines = input.split('\n').filter(line => line.trim());
  const data = [];

  // Skip header row and empty first data row
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length >= 3) {
      data.push({
        month: parseInt(cols[0]),
        sessions: parseInt(cols[1]),
        monthName: cols[2]
      });
    }
  }

  return data;
}

function parseBreakdownData(input) {
  const lines = input.split('\n').filter(line => line.trim());
  const data = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length >= 3) {
      data.push({
        month: parseInt(cols[0]),
        source: cols[1],
        sessions: parseInt(cols[2])
      });
    }
  }

  return data;
}

function createLineChart(data) {
  if (currentChart) {
    currentChart.destroy();
  }

  if (!data || data.length === 0) {
    alert('No valid data to display');
    return;
  }


  const labels = data.map(d => d.monthName);
  const sessions = data.map(d => d.sessions);

  const ctx = document.getElementById('chartCanvas').getContext('2d');

  if (typeof Chart === 'undefined') {
    alert('Chart.js library not loaded. Please check your internet connection.');
    return;
  }

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sessions',
        data: sessions,
        borderColor: '#333333',
        backgroundColor: '#53ff45',
        pointBackgroundColor: '#53ff45',
        pointBorderColor: '#333333',
        pointBorderWidth: 2,
        pointRadius: 5,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'AI Traffic Over Time'
        },
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 6,
            boxHeight: 6
          }
        },
        datalabels: {
          align: 'top',
          anchor: 'end',
          formatter: (value) => value,
          color: '#333333',
          font: {
            weight: 'bold',
            size: 11
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 500
          },
          grid: {
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });

  document.getElementById('chartContainer').style.display = 'block';
  document.getElementById('downloadChart').style.display = 'inline-block';
  document.getElementById('downloadChart').disabled = false;
}

function createDoughnutChart(data) {
  if (currentChart) {
    currentChart.destroy();
  }

  if (!data || data.length === 0) {
    alert('No valid data to display');
    return;
  }


  // Aggregate sessions by source
  const sourceMap = {};
  data.forEach(d => {
    if (!sourceMap[d.source]) {
      sourceMap[d.source] = 0;
    }
    sourceMap[d.source] += d.sessions;
  });

  const sources = Object.keys(sourceMap);
  const sessions = Object.values(sourceMap);

  // Map sources to brand colors
  const colorMap = {
    'chatgpt.com': '#74AA9C',
    'perplexity.ai': '#1C8CF2',
    'gemini.google.com': '#4796E3',
    'copilot.microsoft.com': '#6B4CD6',
    'claude.ai': '#DA7A59',
    'grok.com': '#111111',
    'poe.com': '#B92B27'
  };
  
  // Map sources to icon files
  const iconMap = {
    'chatgpt.com': 'icons/chatgpt-icon.svg',
    'copilot.microsoft.com': 'icons/copilot-icon.svg',
    'gemini.google.com': 'icons/google-gemini-icon.svg',
    'perplexity.ai': 'icons/perplexity-icon.svg',
    'claude.ai': 'icons/claude-icon.svg',
    'grok.com': 'icons/grok-icon.svg',
    'poe.com': 'icons/poe-color.svg'
  };
  
  const colors = sources.map(source => colorMap[source] || '#999999');
  
  // Create custom legend
  const legendContainer = document.getElementById('customLegend');
  legendContainer.innerHTML = '';
  sources.forEach((source, index) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color';
    colorBox.style.backgroundColor = colors[index];
    
    const icon = document.createElement('img');
    icon.className = 'legend-icon';
    icon.src = iconMap[source] || '';
    icon.alt = source;
    
    item.appendChild(colorBox);
    item.appendChild(icon);
    legendContainer.appendChild(item);
  });

  const ctx = document.getElementById('chartCanvas').getContext('2d');

  if (typeof Chart === 'undefined') {
    alert('Chart.js library not loaded. Please check your internet connection.');
    return;
  }

  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sources,
      datasets: [{
        data: sessions,
        backgroundColor: colors,
        borderWidth: 0,
        spacing: 8,
        borderRadius: {
          outerStart: 6,
          outerEnd: 6,
          innerStart: 0,
          innerEnd: 0
        }
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: 'AI Traffic Breakdown by Source'
        },
        legend: {
          display: false
        },
        datalabels: {
          color: '#ffffff',
          font: {
            weight: 'normal',
            size: 16
          },
          formatter: (value, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100);
            if (percentage < 5) return '';
            return percentage.toFixed(1) + '%';
          }
        }
      }
    }
  });

  document.getElementById('chartContainer').style.display = 'flex';
  document.getElementById('downloadChart').style.display = 'inline-block';
  document.getElementById('downloadChart').disabled = false;
}
