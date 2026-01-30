let currentMode = 'overtime';
let parsedData = null;
let currentSvg = null;

// Mode toggle
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('chartContainer').classList.remove('doughnut-mode');
    document.getElementById('downloadChart').style.display = 'none';
    d3.select('#chartCanvas').selectAll('*').remove();
    d3.select('#customLegend').html('');
    currentSvg = null;
  });
});

// Download chart button
document.getElementById('downloadChart').addEventListener('click', () => {
  if (!currentSvg) return;

  // Get the original SVG dimensions
  const svgNode = currentSvg.node();
  const viewBox = svgNode.getAttribute('viewBox');
  const viewBoxValues = viewBox ? viewBox.split(' ') : null;

  // Use viewBox dimensions if available, otherwise use width/height attributes
  const origWidth = viewBoxValues ? parseFloat(viewBoxValues[2]) : parseFloat(svgNode.getAttribute('width'));
  const origHeight = viewBoxValues ? parseFloat(viewBoxValues[3]) : parseFloat(svgNode.getAttribute('height'));

  // Export dimensions
  const exportWidth = 3200;
  const exportHeight = 1800;

  // Clone and scale the SVG
  const clone = svgNode.cloneNode(true);
  clone.setAttribute('width', exportWidth);
  clone.setAttribute('height', exportHeight);
  clone.setAttribute('viewBox', `0 0 ${origWidth} ${origHeight}`);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  // Use document.title for filename (sanitize it), fallback to 'tokarank'
  const pageTitle = (document.title || 'tokarank').toString();
  const sanitized = pageTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  // Try to get active tab title for filename; requires 'tabs' and 'scripting' permissions in manifest
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.title) {
        const finalSanitized = (tab.title || pageTitle).toString().split(' - ')[0].replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
        // Format timestamp as DD-MM-YYYY
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const ts = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
        link.download = `${finalSanitized}-${currentMode === 'overtime' ? 'ai-traffic-over-time' : 'ai-traffic-breakdown-by-source'}-${ts}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    });
  } else {
    // Format timestamp as DD-MM-YYYY-HHMMSS
    const now2 = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const ts2 = `${pad2(now2.getDate())}-${pad2(now2.getMonth() + 1)}-${now2.getFullYear()}`;
    link.download = `${sanitized}-${currentMode}-${ts2}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
});

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
  if (!data || data.length === 0) {
    alert('No valid data to display');
    return;
  }

  // Clear previous chart
  d3.select('#chartCanvas').selectAll('*').remove();

  // Set up dimensions
  const margin = { top: 60, right: 100, bottom: 60, left: 80 };
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Create SVG
  const svg = d3.select('#chartCanvas')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .attr('font-family', "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif")
    .style('background', 'white');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Set up scales
  const x = d3.scalePoint()
    .domain(data.map(d => d.monthName))
    .range([0, width])
    .padding(0);

  const maxSessions = d3.max(data, d => d.sessions);

  // Calculate increment to show approximately 4 ticks
  const targetTicks = 4;
  const rawIncrement = maxSessions / targetTicks;
  // Round to nearest nice number (100, 250, 500, 1000, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawIncrement)));
  const normalized = rawIncrement / magnitude;
  let niceIncrement;
  if (normalized <= 1) niceIncrement = magnitude;
  else if (normalized <= 2) niceIncrement = 2 * magnitude;
  else if (normalized <= 5) niceIncrement = 5 * magnitude;
  else niceIncrement = 10 * magnitude;

  const y = d3.scaleLinear()
    .domain([0, Math.ceil(maxSessions / niceIncrement) * niceIncrement])
    .range([height, 0]);

  // Add grid lines
  const gridGroup = g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y)
      .tickSize(-width)
      .tickFormat('')
      .ticks(Math.ceil(maxSessions / niceIncrement))
    );

  gridGroup.selectAll('line')
    .style('stroke', '#cccccc')
    .style('stroke-opacity', 1);

  gridGroup.select('.domain').remove();

  // Add X axis
  const xAxis = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  xAxis.selectAll('text')
    .style('font-size', '12px')
    .style('fill', '#484B5B')
    .style('font-family', '\'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');

  xAxis.selectAll('line')
    .style('stroke', '#333333');

  xAxis.select('.domain').remove();

  // Add Y axis
  const yAxis = g.append('g')
    .call(d3.axisLeft(y)
      .ticks(Math.ceil(maxSessions / niceIncrement))
      .tickSize(0)
      .tickFormat(d => d)
    );

  yAxis.selectAll('text')
    .style('font-size', '12px')
    .style('fill', '#484B5B');

  yAxis.selectAll('line')
    .style('stroke', '#333333');

  yAxis.select('.domain').remove();

  // Create line generator
  const line = d3.line()
    .x(d => x(d.monthName))
    .y(d => y(d.sessions))
    .curve(d3.curveCardinal.tension(0.7));

  // Create area generator for shadow
  const area = d3.area()
    .x(d => x(d.monthName))
    .y0(height)
    .y1(d => y(d.sessions))
    .curve(d3.curveCardinal.tension(0.7));

  // Define gradient for shadow
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'line-shadow-gradient')
    .attr('x1', '0%')
    .attr('x2', '0%')
    .attr('y1', '0%')
    .attr('y2', '100%');

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#484B5B')
    .attr('stop-opacity', 0.3);

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#484B5B')
    .attr('stop-opacity', 0);

  // Add shadow area
  g.append('path')
    .datum(data)
    .attr('fill', 'url(#line-shadow-gradient)')
    .attr('d', area);

  // Add the line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#484B5B')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Add points
  g.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => x(d.monthName))
    .attr('cy', d => y(d.sessions))
    .attr('r', 5)
    .attr('fill', '#53ff45')
    .attr('stroke', '#333333')
    .attr('stroke-width', 2);

  // Add data labels
  g.selectAll('.label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('x', d => x(d.monthName))
    .attr('y', d => y(d.sessions) - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#484B5B')
    .text(d => d.sessions);

  // Add title (left-aligned)
  svg.append('text')
    .attr('x', margin.left)
    .attr('y', 30)
    .attr('text-anchor', 'start')
    .style('font-size', '16px')
    .style('font-weight', '600')
    .style('fill', '#484B5B')
    .text('AI Traffic Over Time');

  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width + margin.left - 80}, 20)`);

  legend.append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 3)
    .attr('fill', '#53ff45')
    .attr('stroke', '#333333')
    .attr('stroke-width', 1);

  legend.append('text')
    .attr('x', 10)
    .attr('y', 5)
    .style('font-size', '12px')
    .style('fill', '#484B5B')
    .text('Sessions');

  currentSvg = svg;
  document.getElementById('chartContainer').classList.remove('doughnut-mode');
  document.getElementById('chartContainer').style.display = 'block';
  document.getElementById('downloadChart').style.display = 'inline-block';
  document.getElementById('downloadChart').disabled = false;
}

function createDoughnutChart(data) {
  if (!data || data.length === 0) {
    alert('No valid data to display');
    return;
  }

  // Clear previous chart
  d3.select('#chartCanvas').selectAll('*').remove();

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
    'poe.com': 'icons/poe-icon.svg'
  };

  const chartData = sources.map((source, i) => ({
    source,
    sessions: sessions[i],
    color: colorMap[source] || '#999999'
  }));

  // Create custom legend (HTML version)
  const legendContainer = document.getElementById('customLegend');
  legendContainer.innerHTML = '';
  chartData.forEach((d) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color';
    colorBox.style.backgroundColor = d.color;

    const icon = document.createElement('img');
    icon.className = 'legend-icon';
    icon.src = iconMap[d.source] || '';
    icon.alt = d.source;

    item.appendChild(colorBox);
    item.appendChild(icon);
    legendContainer.appendChild(item);
  });

  // Load icons as data URIs for SVG embedding
  loadIconsAsDataUris(chartData, iconMap).then(iconDataMap => {
    renderDoughnutSvg(chartData, iconDataMap);
  });
}

function loadIconsAsDataUris(chartData, iconMap) {
  const promises = chartData.map(d => {
    const iconPath = iconMap[d.source];
    console.log('Loading icon for', d.source, 'from', iconPath);

    return fetch(iconPath)
      .then(response => {
        if (!response.ok) {
          console.error('Failed to fetch', iconPath, response.status);
          return { source: d.source, dataUri: '' };
        }
        return response.text();
      })
      .then(svgText => {
        if (!svgText || svgText === '') {
          console.error('Empty SVG for', d.source);
          return { source: d.source, dataUri: '' };
        }

        // Fix SVG attributes - replace em units with actual pixel values
        svgText = svgText.replace(/width="1em"/g, 'width="24"');
        svgText = svgText.replace(/height="1em"/g, 'height="24"');

        // Encode SVG as data URI directly
        const encoded = btoa(unescape(encodeURIComponent(svgText)));
        const dataUri = `data:image/svg+xml;base64,${encoded}`;
        console.log('Successfully encoded icon for', d.source);
        return { source: d.source, dataUri: dataUri };
      })
      .catch(err => {
        console.error('Error loading icon for', d.source, err);
        return { source: d.source, dataUri: '' };
      });
  });

  return Promise.all(promises).then(results => {
    const map = {};
    results.forEach(r => {
      map[r.source] = r.dataUri;
      console.log('Icon data URI length for', r.source, ':', r.dataUri.length);
    });
    return map;
  });
}

function renderDoughnutSvg(chartData, iconDataMap) {
  // Set up dimensions - make SVG wider to include legend
  const chartWidth = 400;
  const chartHeight = 450; // Increased to give title more room
  const legendGap = 90; // Increased from 40 to 90
  const legendWidth = 120; // Increased to prevent overflow
  const totalWidth = chartWidth + legendGap + legendWidth;
  const radius = Math.min(chartWidth, 400) / 2; // Use 400 for radius calculation

  // Create SVG
  const svg = d3.select('#chartCanvas')
    .attr('width', totalWidth)
    .attr('height', chartHeight)
    .attr('viewBox', `0 0 ${totalWidth} ${chartHeight}`)
    .attr('font-family', "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif")
    .style('background', 'transparent');

  const g = svg.append('g')
    .attr('transform', `translate(${chartWidth / 2},${chartHeight / 2 + 25})`);

  // Create pie layout
  const pie = d3.pie()
    .value(d => d.sessions)
    .sort(null);

  // Create arc generator
  const arc = d3.arc()
    .innerRadius(radius * 0.45) // Slightly thinner than 0.4
    .outerRadius(radius * 0.9)
    .cornerRadius(6)
    .padAngle(0.01); // Reduced from 0.03 for less spacing

  // Create arcs
  const arcs = g.selectAll('.arc')
    .data(pie(chartData))
    .enter()
    .append('g')
    .attr('class', 'arc');

  // Add path for each arc
  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color);

  // Add percentage labels
  const total = d3.sum(chartData, d => d.sessions);
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .style('font-size', '18px')
    .style('fill', '#ffffff')
    .text(d => {
      const percentage = (d.data.sessions / total) * 100;
      return percentage >= 5 ? percentage.toFixed(1) + '%' : '';
    });

  // Add title - left-aligned for chart + legend
  svg.append('text')
    .attr('x', 20) // small left padding
    .attr('y', 30)
    .attr('text-anchor', 'start')
    .style('font-size', '16px')
    .style('font-weight', '600')
    .style('fill', '#484B5B')
    .text('AI Traffic Breakdown by Source');

  currentSvg = svg;

  // For export: create SVG version of legend with embedded icons
  createSvgLegend(svg, chartData, iconDataMap, chartWidth, chartHeight);

  document.getElementById('chartContainer').classList.add('doughnut-mode');
  document.getElementById('chartContainer').style.display = 'flex';
  document.getElementById('downloadChart').style.display = 'inline-block';
  document.getElementById('downloadChart').disabled = false;
}

function createSvgLegend(svg, chartData, iconDataMap, chartWidth, chartHeight) {
  // Remove any existing SVG legend first
  svg.select('.svg-legend').remove();

  // Calculate spacing - reduced to 300px height
  const legendHeight = 300;
  const itemSpacing = legendHeight / (chartData.length - 1);

  // Center legend at same height as doughnut center
  const doughnutCenterY = chartHeight / 2 + 25;
  const legendStartY = doughnutCenterY - ((chartData.length - 1) * itemSpacing) / 2;

  const legendGroup = svg.append('g')
    .attr('class', 'svg-legend')
    .attr('transform', `translate(${chartWidth + 90}, ${legendStartY})`);

  chartData.forEach((d, i) => {
    const legendItem = legendGroup.append('g')
      .attr('transform', `translate(0, ${i * itemSpacing})`);

    // Color circle
    legendItem.append('circle')
      .attr('cx', 8)
      .attr('cy', 12)
      .attr('r', 6)
      .attr('fill', d.color);

    // Load and embed icon as image with data URI
    const dataUri = iconDataMap[d.source];
    console.log('Adding icon for', d.source, 'dataUri exists:', !!dataUri);
    if (dataUri && dataUri.length > 0) {
      legendItem.append('image')
        .attr('x', 24)
        .attr('y', 0)
        .attr('width', 24)
        .attr('height', 24)
        .attr('href', dataUri)
        .attr('xlink:href', dataUri); // Try both for compatibility
    }
  });
}
