import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, apiKey } = await request.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({
        success: false,
        fallback: true,
        error: 'No API key provided',
      });
    }

    const cleanKey = apiKey.trim();

    // Step 1: Discover which exact models Google authorizes for this specific key
    let discoveredModels = [];
    let listModelsError = null;

    try {
      const modelsRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
      );
      const modelsData = await modelsRes.json();

      if (modelsRes.ok && modelsData.models && Array.isArray(modelsData.models)) {
        // Filter STRICTLY for text-generating models (EXCLUDE TTS, Audio-only, ImageGen, and Embeddings)
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

    // Sort discovered models so standard text flash models are prioritized:
    // e.g. gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
    discoveredModels.sort((a, b) => {
      const getPriority = (name) => {
        const n = name.toLowerCase();
        if (n === 'gemini-2.5-flash') return 100;
        if (n === 'gemini-2.0-flash') return 90;
        if (n === 'gemini-1.5-flash') return 80;
        if (n === 'gemini-1.5-flash-latest') return 75;
        if (n.includes('2.5-flash') && !n.includes('tts')) return 70;
        if (n.includes('2.0-flash') && !n.includes('tts')) return 65;
        if (n.includes('1.5-flash') && !n.includes('tts')) return 60;
        if (n.includes('pro')) return 50;
        return 10;
      };
      return getPriority(b) - getPriority(a);
    });

    // Build model trial list: prioritized discovered text models first, then standard fallbacks
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
      const isBad = lower.includes('tts') || lower.includes('audio') || lower.includes('embed');
      return !isBad && self.indexOf(val) === idx;
    });

    const systemPrompt = `You are SmartOccupy AI, an intelligent college classroom resource optimization copilot.
Context:
- College dataset has 5,000 timetable sessions across departments: CSE, AIDS, IT, ECE, EEE.
- Classrooms: R101 (30s), R102 (40s), R103 (50s), R104 (60s), R105 (75s), R201 (90s, Lab), R202 (100s, Seminar), R203 (120s, Lecture), R204 (150s, Lecture).
- Formulas:
  Occupancy % = (actual_students / room_capacity) * 100
  Room Utilization % = (used_hours / available_hours) * 100
  Buffer = Predicted + 10%
- Multi-constraint scoring: +40 for capacity fit, +30 availability, +20 no timetable clash, +15 equipment, +20 min unused capacity bonus, +10 location.
- Machine Learning: Multiple Linear Regression (MAE ~5.3), Random Forest.
Provide concise, practical, technical explanations suitable for engineering students and academic deans.`;

    let aiResponseText = null;
    let successfulModel = null;
    let lastErrorMessage = listModelsError || null;

    // Try text candidate models across v1beta and v1
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
                  parts: [
                    {
                      text: `${systemPrompt}\n\nUser Question: ${prompt.trim()}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 800,
                temperature: 0.7,
              },
            }),
          });

          const data = await res.json();

          if (res.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            aiResponseText = data.candidates[0].content.parts[0].text;
            successfulModel = model;
            break;
          } else if (data.error) {
            lastErrorMessage = data.error.message || 'API error';

            // Only break out if the key itself is completely invalid or unauthorized
            const isInvalidAuth =
              res.status === 401 ||
              (res.status === 400 && lastErrorMessage.toLowerCase().includes('api key not valid')) ||
              lastErrorMessage.toLowerCase().includes('api_key_invalid');

            if (isInvalidAuth) {
              return NextResponse.json({
                success: false,
                error: lastErrorMessage,
                availableModels: discoveredModels,
              });
            }
            // If it was a model-specific error (like modality, preview restrictions, 404), CONTINUE to next model!
          }
        } catch (fetchErr) {
          lastErrorMessage = fetchErr.message;
        }
      }
      if (aiResponseText) break;
    }

    if (aiResponseText) {
      return NextResponse.json({
        success: true,
        answer: aiResponseText,
        model: successfulModel,
        availableModels: discoveredModels,
      });
    }

    return NextResponse.json({
      success: false,
      error: lastErrorMessage || 'Could not connect to Gemini model endpoint',
      availableModels: discoveredModels,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
