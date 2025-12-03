import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle, Video, Mail, Send, Settings, RefreshCw, Search, X } from 'lucide-react';

const FreshServiceAnalyzer = () => {
  const [config, setConfig] = useState({
    fsApiKey: '',
    fsDomain: '',
    slackWebhook: '',
    anthropicApiKey: '',
    smtpConfig: {},
    ticketStatuses: [2, 3, 4, 5, 6, 7], // Default: All statuses selected
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
      to: new Date().toISOString().split('T')[0] // Today
    },
    analysisCriteria: {
      troubleshootingSteps: { enabled: true, text: "Are troubleshooting steps documented?" },
      rootCause: { enabled: true, text: "Is the root cause identified and explained?" },
      resolutionDetails: { enabled: true, text: "Is the resolution clearly described?" },
      logicalProgression: { enabled: true, text: "Is there a logical progression showing the investigation?" },
      technicalDetails: { enabled: true, text: "Are technical details sufficient?" },
      loomVideos: { enabled: true, text: "Are Loom video links present for complex issues?" },
      preventiveMeasures: { enabled: true, text: "Are preventive measures or follow-ups mentioned?" }
    }
  });
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]); // Store all tickets for filtering
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showConfig, setShowConfig] = useState(true);
  const [analysisResults, setAnalysisResults] = useState({});
  const [agentFilter, setAgentFilter] = useState('');

  const fetchTickets = async () => {
    if (!config.fsApiKey || !config.fsDomain) {
      alert('Please configure FreshService credentials first');
      return;
    }

    setAnalyzing(true);
    try {
      // Clean domain (remove https:// and trailing slashes)
      let domain = config.fsDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // If domain doesn't include .freshservice.com, add it
      if (!domain.includes('.freshservice.com')) {
        domain = `${domain}.freshservice.com`;
      }
      
      const baseUrl = `https://${domain}/api/v2`;

      // First, test the connection with a simple request
      const testUrl = `${baseUrl}/tickets?per_page=1`;
      console.log('Testing connection to:', testUrl);
      
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(config.fsApiKey + ':X')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!testResponse.ok) {
        let errorText = '';
        try {
          errorText = await testResponse.text();
        } catch (e) {
          errorText = testResponse.statusText;
        }
        
        const errorDetails = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          url: testUrl,
          error: errorText
        };
        
        console.error('API Error:', errorDetails);
        
        if (testResponse.status === 404) {
          throw new Error(
            `API endpoint not found (404).\n\n` +
            `Tried URL: ${testUrl}\n\n` +
            `Please verify:\n` +
            `- Your domain is correct (e.g., "yourcompany" or "yourcompany.freshservice.com")\n` +
            `- Your FreshService account is active\n` +
            `- You're using API v2 (not v1)`
          );
        } else if (testResponse.status === 401) {
          throw new Error(
            `Authentication failed (401).\n\n` +
            `Please verify your API key is correct.\n` +
            `Get your API key from: Profile Settings → API Key`
          );
        } else {
          throw new Error(
            `Failed to connect to FreshService API.\n\n` +
            `Status: ${testResponse.status} ${testResponse.statusText}\n` +
            `URL: ${testUrl}\n` +
            `Error: ${errorText}`
          );
        }
      }

      // Use configured date range
      const dateFrom = config.dateRange.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dateTo = config.dateRange.to || new Date().toISOString().split('T')[0];

      // Fetch tickets - use query parameters instead of filter
      // Status 2 = Open, 3 = Pending, 4 = Resolved, 5 = Closed
      const ticketsUrl = `${baseUrl}/tickets?updated_since=${dateFrom}&per_page=100&order_by=updated_at&order_type=desc`;
      console.log('Fetching tickets from:', ticketsUrl);
      
      const ticketsResponse = await fetch(ticketsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(config.fsApiKey + ':X')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!ticketsResponse.ok) {
        let errorText = '';
        try {
          errorText = await ticketsResponse.text();
        } catch (e) {
          errorText = ticketsResponse.statusText;
        }
        throw new Error(`Failed to fetch tickets: ${ticketsResponse.status} ${errorText}`);
      }

      const ticketsData = await ticketsResponse.json();
      // Filter by configured statuses client-side
      const selectedStatuses = config.ticketStatuses && config.ticketStatuses.length > 0 
        ? config.ticketStatuses 
        : [4, 5]; // Default to Resolved and Closed
      
      const ticketsList = (ticketsData.tickets || []).filter(
        ticket => selectedStatuses.includes(ticket.status)
      );

      // Fetch private notes for each ticket
      const ticketsWithNotes = await Promise.all(
        ticketsList.map(async (ticket) => {
          try {
            // Fetch conversations (which includes private notes)
            const conversationsResponse = await fetch(
              `${baseUrl}/tickets/${ticket.id}/conversations`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${btoa(config.fsApiKey + ':X')}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            let private_notes = [];
            if (conversationsResponse.ok) {
              const conversationsData = await conversationsResponse.json();
              // Filter for private notes (note_type: 2 is private note)
              private_notes = (conversationsData.conversations || [])
                .filter(conv => conv.private === true || conv.note_type === 2)
                .map(conv => ({
                  body: conv.body_text || conv.body || '',
                  created_at: conv.created_at || conv.updated_at
                }))
                .filter(note => note.body.trim().length > 0);
            }

            // Get agent name from responder_id or assignee
            let agentName = 'Unknown';
            if (ticket.responder_id) {
              try {
                const agentResponse = await fetch(
                  `${baseUrl}/agents/${ticket.responder_id}`,
                  {
                    method: 'GET',
                    headers: {
                      'Authorization': `Basic ${btoa(config.fsApiKey + ':X')}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                if (agentResponse.ok) {
                  const agentData = await agentResponse.json();
                  agentName = agentData.agent?.first_name + ' ' + agentData.agent?.last_name || 'Unknown';
                }
              } catch (e) {
                console.warn('Could not fetch agent name:', e);
              }
            }

            return {
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status_name || 'Unknown',
              agent: agentName,
              created_at: ticket.created_at,
              updated_at: ticket.updated_at,
              private_notes: private_notes
            };
          } catch (error) {
            console.error(`Error fetching notes for ticket ${ticket.id}:`, error);
            return {
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status_name || 'Unknown',
              agent: 'Unknown',
              created_at: ticket.created_at,
              updated_at: ticket.updated_at,
              private_notes: []
            };
          }
        })
      );

      // Filter out tickets with no private notes (can't analyze without notes)
      const ticketsWithPrivateNotes = ticketsWithNotes.filter(ticket => ticket.private_notes.length > 0);

      if (ticketsWithPrivateNotes.length === 0) {
        alert('No tickets with private notes found. Make sure you have resolved tickets with private notes in the last 30 days.');
      }

      // Store all tickets and apply current filter
      setAllTickets(ticketsWithPrivateNotes);
      applyAgentFilter(ticketsWithPrivateNotes, agentFilter);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      alert(`Error fetching tickets: ${error.message}\n\nMake sure:\n- Your FreshService domain is correct (e.g., yourcompany.freshservice.com)\n- Your API key is valid\n- You have tickets with private notes`);
    }
    setAnalyzing(false);
  };

  // Apply agent filter
  const applyAgentFilter = (ticketsToFilter, filterValue) => {
    if (!filterValue || filterValue.trim() === '') {
      setTickets(ticketsToFilter);
    } else {
      const filtered = ticketsToFilter.filter(ticket =>
        ticket.agent.toLowerCase().includes(filterValue.toLowerCase().trim())
      );
      setTickets(filtered);
    }
  };

  // Handle agent filter change
  const handleAgentFilterChange = (value) => {
    setAgentFilter(value);
    applyAgentFilter(allTickets, value);
  };

  // Get unique list of agents from tickets
  const availableAgents = useMemo(() => {
    const agents = new Set(allTickets.map(ticket => ticket.agent).filter(Boolean));
    return Array.from(agents).sort();
  }, [allTickets]);

  const analyzeTicketNotes = async (ticket) => {
    if (!config.anthropicApiKey) {
      alert('Please configure Anthropic API key in settings to use the analysis feature');
      return;
    }

    setAnalyzing(true);
    setSelectedTicket(ticket);

    const notesText = ticket.private_notes
      .map(note => `[${note.created_at}] ${note.body}`)
      .join('\n\n');

    const prompt = `You are analyzing IT support ticket documentation quality. 

Ticket: ${ticket.subject}
Status: ${ticket.status}
Agent: ${ticket.agent}

Private Notes:
${notesText}

Evaluate this ticket's documentation against these criteria:
${Object.entries(config.analysisCriteria)
  .filter(([key, criterion]) => criterion.enabled)
  .map(([key, criterion]) => `- ${criterion.text}`)
  .join('\n')}

Provide:
1. A score from 1-10 for overall documentation quality
2. Specific feedback on what's done well
3. Specific feedback on what's missing or could be improved
4. Whether the agent should be commended or coached
5. Actionable suggestions for improvement

Format your response as JSON with this structure:
{
  "score": <number>,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "hasLoomVideo": <boolean>,
  "recommendation": "commend" or "coach",
  "feedback": "detailed feedback text for the agent",
  "managerSummary": "summary for manager"
}`;

    try {
      // Use proxy server to avoid CORS issues
      const apiUrl = "http://localhost:3001/api/analyze";
      console.log('Calling Anthropic API via proxy:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: config.anthropicApiKey,
          prompt: prompt
        })
      });

      if (!response.ok) {
        let errorMessage = 'API request failed';
        let errorData = null;
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
          console.error('Proxy API Error:', errorData);
        } catch (e) {
          const text = await response.text();
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
          console.error('Failed to parse error response:', e, text);
        }
        
        if (response.status === 404) {
          // Check if it's a proxy server 404 or Anthropic API 404
          if (errorMessage.includes('model') || errorMessage.includes('Route not found')) {
            throw new Error(
              `Proxy server endpoint not found (404).\n\n` +
              `Make sure:\n` +
              `- The proxy server is running (npm run server)\n` +
              `- The server is on port 3001\n` +
              `- Restart the server after code changes\n\n` +
              `Error: ${errorMessage}`
            );
          } else {
            throw new Error(`Anthropic API endpoint not found. Error: ${errorMessage}`);
          }
        } else if (response.status === 400) {
          throw new Error(
            `Invalid request to Anthropic API.\n\n` +
            `This might be due to:\n` +
            `- Invalid model name\n` +
            `- Invalid request format\n` +
            `- Missing required parameters\n\n` +
            `Error: ${errorMessage}`
          );
        } else if (response.status === 401) {
          throw new Error('Invalid Anthropic API key. Please check your API key in settings.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        } else {
          throw new Error(`Anthropic API error (${response.status}): ${errorMessage}`);
        }
      }

      const data = await response.json();
      
      if (!data.content || !Array.isArray(data.content)) {
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      const analysisText = data.content
        .filter(item => item.type === "text")
        .map(item => item.text)
        .join("");

      if (!analysisText) {
        throw new Error('Empty response from Anthropic API');
      }

      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (analysis) {
        setAnalysisResults(prev => ({
          ...prev,
          [ticket.id]: analysis
        }));
      } else {
        console.error('Failed to parse JSON from response:', analysisText);
        alert('Failed to parse analysis response. The AI response may not be in the expected format. Check console for details.');
      }
    } catch (error) {
      console.error('Error analyzing ticket:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(
          `Network error connecting to Anthropic API.\n\n` +
          `Make sure the proxy server is running:\n` +
          `- Run "npm run server" in a separate terminal, OR\n` +
          `- Run "npm run dev:full" to start both servers\n\n` +
          `The proxy server should be running on http://localhost:3001\n\n` +
          `Error: ${error.message}`
        );
      } else {
        alert(`Error analyzing ticket: ${error.message}`);
      }
    }
    setAnalyzing(false);
  };

  const sendNotification = async (ticket, method) => {
    const analysis = analysisResults[ticket.id];
    if (!analysis) return;

    const message = `Hi ${ticket.agent},

Your ticket #${ticket.id} "${ticket.subject}" has been reviewed.

Score: ${analysis.score}/10

${analysis.recommendation === 'commend' ? '🌟 Great work!' : '📝 Coaching Opportunity'}

${analysis.feedback}

Keep up the great work!
- IT Management`;

    if (method === 'email') {
      alert(`Email notification would be sent to ${ticket.agent}\n\n${message}`);
    } else if (method === 'slack') {
      alert(`Slack notification would be sent to ${ticket.agent}\n\n${message}`);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (showConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold mb-6">FreshService Configuration</h1>
            
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
              {/* API Configuration Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">API Configuration</h2>
                
                <div>
                  <label className="block text-sm font-medium mb-2">FreshService Domain</label>
                  <input
                    type="text"
                    placeholder="yourcompany (or yourcompany.freshservice.com)"
                    className="w-full px-3 py-2 border rounded-md"
                    value={config.fsDomain}
                    onChange={(e) => setConfig({...config, fsDomain: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter just your subdomain (e.g., "yourcompany") or the full domain</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">FreshService API Key</label>
                  <input
                    type="password"
                    placeholder="Your API key"
                    className="w-full px-3 py-2 border rounded-md"
                    value={config.fsApiKey}
                    onChange={(e) => setConfig({...config, fsApiKey: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Anthropic API Key (for analysis)</label>
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 border rounded-md"
                    value={config.anthropicApiKey}
                    onChange={(e) => setConfig({...config, anthropicApiKey: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Get your API key from https://console.anthropic.com/</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Slack Webhook URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 border rounded-md"
                    value={config.slackWebhook}
                    onChange={(e) => setConfig({...config, slackWebhook: e.target.value})}
                  />
                </div>
              </div>

              {/* Ticket Filter Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Ticket Filters</h2>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Ticket Status</label>
                  <p className="text-xs text-gray-500 mb-2">Select which ticket statuses to fetch:</p>
                  <div className="space-y-2">
                    {[
                      { value: 2, label: 'Open' },
                      { value: 3, label: 'Pending' },
                      { value: 4, label: 'Resolved' },
                      { value: 5, label: 'Closed' },
                      { value: 6, label: 'Waiting on Customer' },
                      { value: 7, label: 'Waiting on Third Party' }
                    ].map(status => (
                      <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.ticketStatuses.includes(status.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig({
                                ...config,
                                ticketStatuses: [...config.ticketStatuses, status.value]
                              });
                            } else {
                              setConfig({
                                ...config,
                                ticketStatuses: config.ticketStatuses.filter(s => s !== status.value)
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Date From</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded-md"
                      value={config.dateRange.from}
                      onChange={(e) => setConfig({
                        ...config,
                        dateRange: {
                          ...config.dateRange,
                          from: e.target.value
                        }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Date To</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded-md"
                      value={config.dateRange.to}
                      onChange={(e) => setConfig({
                        ...config,
                        dateRange: {
                          ...config.dateRange,
                          to: e.target.value
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Analysis Criteria Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Grading Criteria</h2>
                <p className="text-sm text-gray-600 mb-4">Enable/disable and customize the criteria used to evaluate ticket documentation quality:</p>
                
                {Object.entries(config.analysisCriteria).map(([key, criterion]) => (
                  <div key={key} className="border rounded-md p-3 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center pt-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={criterion.enabled}
                            onChange={(e) => setConfig({
                              ...config,
                              analysisCriteria: {
                                ...config.analysisCriteria,
                                [key]: {
                                  ...criterion,
                                  enabled: e.target.checked
                                }
                              }
                            })}
                            className="sr-only peer"
                          />
                          <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${!criterion.enabled ? 'opacity-50' : ''}`}></div>
                        </label>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">
                          {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <input
                          type="text"
                          className={`w-full px-3 py-2 border rounded-md bg-white ${!criterion.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          value={criterion.text}
                          onChange={(e) => setConfig({
                            ...config,
                            analysisCriteria: {
                              ...config.analysisCriteria,
                              [key]: {
                                ...criterion,
                                text: e.target.value
                              }
                            }
                          })}
                          placeholder="Enter evaluation criterion"
                          disabled={!criterion.enabled}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowConfig(false)}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 mt-6"
              >
                Save & Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Ticket Note Analyzer</h1>
            <div className="flex gap-2">
              <button
                onClick={fetchTickets}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                {analyzing ? 'Loading...' : 'Fetch Tickets'}
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                <Settings size={16} />
                Config
              </button>
            </div>
          </div>
          
          {/* Agent Filter */}
          {allTickets.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by agent name..."
                  className="w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={agentFilter}
                  onChange={(e) => handleAgentFilterChange(e.target.value)}
                />
                {agentFilter && (
                  <button
                    onClick={() => handleAgentFilterChange('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {availableAgents.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{tickets.length}</span> of <span className="font-medium">{allTickets.length}</span> tickets
                  {agentFilter && (
                    <span className="ml-2 text-blue-600">
                      (filtered by: {agentFilter})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {allTickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500">Click "Fetch Tickets" to load tickets from FreshService</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500">No tickets found matching agent filter: "{agentFilter}"</p>
            <button
              onClick={() => handleAgentFilterChange('')}
              className="mt-4 text-blue-600 hover:text-blue-700 underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {tickets.map(ticket => {
              const analysis = analysisResults[ticket.id];
              const hasLoomVideo = ticket.private_notes.some(note => 
                note.body.toLowerCase().includes('loom.com')
              );

              return (
                <div key={ticket.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">#{ticket.id} {ticket.subject}</h3>
                        {hasLoomVideo && (
                          <span className="flex items-center gap-1 text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            <Video size={14} />
                            Loom
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>Agent: {ticket.agent}</span>
                        <span>Status: {ticket.status}</span>
                        <span>Notes: {ticket.private_notes.length}</span>
                      </div>
                    </div>
                    
                    {analysis && (
                      <div className={`px-4 py-2 rounded-md font-bold text-lg ${getScoreBadge(analysis.score)}`}>
                        {analysis.score}/10
                      </div>
                    )}
                  </div>

                  {!analysis ? (
                    <button
                      onClick={() => analyzeTicketNotes(ticket)}
                      disabled={analyzing}
                      className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {analyzing && selectedTicket?.id === ticket.id ? 'Analyzing...' : 'Analyze Notes'}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-semibold mb-2">Manager Summary</h4>
                        <p className="text-sm text-gray-700">{analysis.managerSummary}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-green-700">Strengths</h4>
                          <ul className="text-sm space-y-1">
                            {analysis.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 text-orange-700">Areas for Improvement</h4>
                          <ul className="text-sm space-y-1">
                            {analysis.weaknesses.map((w, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="font-semibold mb-2">Agent Feedback</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.feedback}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => sendNotification(ticket, 'email')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          <Mail size={16} />
                          Send Email
                        </button>
                        <button
                          onClick={() => sendNotification(ticket, 'slack')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                        >
                          <Send size={16} />
                          Send to Slack
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FreshServiceAnalyzer;

