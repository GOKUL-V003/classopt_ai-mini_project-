import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

// Helper function to execute python ai_copilot_cli.py for direct SQLite persistence
function executePythonCopilot(prompt, apiKey) {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.resolve(process.cwd(), '..', 'ai_copilot_cli.py');
      const pyProcess = spawn('python', [scriptPath, prompt], {
        cwd: path.resolve(process.cwd(), '..'),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf-8');
      });

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString('utf-8');
      });

      pyProcess.on('close', (code) => {
        if (code === 0 && stdoutData) {
          // Extract JSON line from output (ignore initialization messages)
          const lines = stdoutData.trim().split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const parsed = JSON.parse(line);
                return resolve(parsed);
              } catch (e) {
                // keep checking previous line
              }
            }
          }
        }
        resolve(null);
      });

      pyProcess.on('error', () => {
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

export async function GET(request) {
  // Return stored AI instructions from SQLite database
  try {
    const flaskRes = await fetch(`${BACKEND_URL}/api/ai-chat-instructions?limit=50`, { cache: 'no-store' });
    if (flaskRes.ok) {
      const data = await flaskRes.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // fallback to CLI
  }

  const cliRes = await executePythonCopilot('view instruction logs', null);
  if (cliRes) {
    return NextResponse.json({ success: true, text: cliRes.text });
  }

  return NextResponse.json({ success: true, instructions: [] });
}

export async function POST(request) {
  try {
    const { prompt, apiKey } = await request.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const cleanPrompt = prompt.trim();
    const cleanKey = (apiKey || '').trim();

    // STEP 1: Attempt to forward to Flask backend Copilot (/api/ai-chat-copilot)
    // Flask handles timetable scheduling, room allocation, and writes directly to SQLite:
    // - events table
    // - ai_chat_instructions table
    try {
      const flaskRes = await fetch(`${BACKEND_URL}/api/ai-chat-copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          apiKey: cleanKey,
        }),
      });

      if (flaskRes.ok) {
        const flaskData = await flaskRes.json();
        if (flaskData && flaskData.success) {
          return NextResponse.json({
            success: true,
            answer: flaskData.text || flaskData.answer,
            model: flaskData.source || 'SmartOccupy Copilot',
            action_executed: flaskData.action_executed || false,
            event_id: flaskData.event_id || null,
            event: flaskData.event || null,
            total_conflicts: flaskData.total_conflicts || 0,
            remedies: flaskData.remedies || [],
          });
        }
      }
    } catch (flaskErr) {
      // Flask service may not be running on 5000; seamlessly proceed to Python CLI bridge
    }

    // STEP 2: Fallback to standalone python copilot CLI bridge
    // Executes scheduling logic and stores instruction in classroom_optimizer.db directly
    const cliResult = await executePythonCopilot(cleanPrompt, cleanKey);
    if (cliResult && cliResult.success && (cliResult.action_executed || !cleanKey)) {
      return NextResponse.json({
        success: true,
        answer: cliResult.text,
        model: cliResult.source || 'SmartOccupy Copilot',
        action_executed: cliResult.action_executed || false,
        event_id: cliResult.event_id || null,
        event: cliResult.event || null,
      });
    }

    // STEP 3: If an external Gemini API key is supplied, attempt live Gemini text generation
    if (cleanKey) {
      let discoveredModels = [];
      let listModelsError = null;

      try {
        const modelsRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
        );
        const modelsData = await modelsRes.json();

        if (modelsRes.ok && modelsData.models && Array.isArray(modelsData.models)) {
          discoveredModels = modelsData.models
            .filter((m) => {
              const clean = m.name.replace(/^models\//, '').toLowerCase();
              const isTtsOrAudio = clean.includes('tts') || clean.includes('audio');
              const isEmbedding = clean.includes('embedding') || clean.includes('embed');
              const isImageOnly = clean.includes('imagen') || clean.includes('image');
              const supportsGen = m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent');
              return supportsGen && !isTtsOrAudio && !isEmbedding && !isImageOnly;
            })
            .map((m) => m.name.replace(/^models\//, ''));
        } else if (modelsData.error) {
          listModelsError = modelsData.error.message || 'Key unauthorized for ModelService';
        }
      } catch (err) {
        listModelsError = err.message;
      }

      discoveredModels.sort((a, b) => {
        const getPriority = (name) => {
          const n = name.toLowerCase();
          if (n === 'gemini-2.5-flash') return 100;
          if (n === 'gemini-2.0-flash') return 90;
          if (n === 'gemini-1.5-flash') return 80;
          if (n === 'gemini-1.5-flash-latest') return 75;
          if (n.includes('2.5-flash')) return 70;
          if (n.includes('2.0-flash')) return 65;
          if (n.includes('1.5-flash')) return 60;
          if (n.includes('pro')) return 50;
          return 10;
        };
        return getPriority(b) - getPriority(a);
      });

      const candidateModels = [
        ...discoveredModels,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-2.5-pro',
      ].filter((val, idx, self) => {
        const lower = val.toLowerCase();
        return !lower.includes('tts') && !lower.includes('audio') && !lower.includes('embed') && self.indexOf(val) === idx;
      });

      const systemPrompt = `You are SmartOccupy AI, an intelligent college classroom resource optimization copilot.
Provide concise, practical explanations suitable for engineering students and academic deans.`;

      let aiResponseText = null;
      let successfulModel = null;
      let lastErrorMessage = listModelsError || null;

      for (const model of candidateModels) {
        for (const ver of ['v1beta', 'v1']) {
          try {
            const endpointUrl = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${cleanKey}`;
            const res = await fetch(endpointUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\nUser Question: ${cleanPrompt}` }],
                  },
                ],
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
              }),
            });

            const data = await res.json();
            if (res.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
              aiResponseText = data.candidates[0].content.parts[0].text;
              successfulModel = model;
              break;
            } else if (data.error) {
              lastErrorMessage = data.error.message || 'API error';
            }
          } catch (fetchErr) {
            lastErrorMessage = fetchErr.message;
          }
        }
        if (aiResponseText) break;
      }

      if (aiResponseText) {
        // Also log this Gemini interaction to DB
        executePythonCopilot(cleanPrompt, null).catch(() => {});

        return NextResponse.json({
          success: true,
          answer: aiResponseText,
          model: successfulModel,
          availableModels: discoveredModels,
        });
      }
    }

    // STEP 4: Return fallback copilot answer
    if (cliResult && cliResult.text) {
      return NextResponse.json({
        success: true,
        answer: cliResult.text,
        model: 'SmartOccupy Copilot',
      });
    }

    return NextResponse.json({
      success: true,
      answer: "I am your AI Campus Resource Copilot. You can ask me to schedule meetings (e.g. 'Schedule a meeting of prompt engineering'), scan for room conflicts, or explain optimization formulas.",
      model: 'SmartOccupy Copilot',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
