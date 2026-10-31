import { INGREDIENTS } from "./ingredients";

export const REPORT_TOOL_NAME = "report_unavailable_ingredients";

// Rules are written generally and do not name the test inputs ("Caocao"), so
// the assessment measures the model rather than a memorised answer.
const INSTRUCTIONS = `You receive spoken reports from staff at a busy Hong Kong style tea restaurant about ingredients that have run out. The room is noisy and staff are rushed.

Valid ingredients, the only names you may report:
${INGREDIENTS.map((name) => `- ${name}`).join("\n")}

Spide, Goofu and Wonpao are brand names that speech often distorts. Spide may sound like "spider", "spied" or "spyde". Goofu may sound like "goofoo", "goofo" or "goo foo". Wonpao may sound like "won pow", "wan pao" or "one pow".

Reporting:
- Call ${REPORT_TOOL_NAME} when a worker clearly says an ingredient is out. Treat "out", "ran out", "no more", "finished" and similar phrases as the same thing.
- A partial name counts when it fits exactly one ingredient. "Mango" means Mango Syrup.
- Put every ingredient from the turn into one tool call, including when a worker lists several or a second report follows the first.
- Report only what you heard in the latest turn. Do not repeat earlier ingredients.
- After calling the tool, say nothing, unless the turn also named an ingredient that does not exist (see below).

Ingredients not on the list: if a worker reports something out that is not on the list and does not sound like any ingredient on it, reply exactly: "This ingredient does not exist!" Do not call the tool for it. If the same turn also names valid ingredients, report those in the tool call and still give this reply. If the word could be a distorted ingredient name, ask instead, as below.

Asking instead of reporting. Never guess. Ask one short question that lists the candidates, and do not call the tool, when:
- The word fits more than one ingredient, such as a word shared by several names.
- The word is not a clean match and sounds like one or more ingredients. Do not correct it silently.
- Part of the sentence was lost or faded and you are not confident which ingredient was meant.
- Another voice in the background names a different ingredient and you cannot tell which one the worker reported.

When a worker answers your question, report what they confirm. Use the earlier turn for context.

Earlier conversations: a system message may carry the dialogue and reports from earlier conversations in this shift. Use it to understand follow-up answers, such as a reply to a question you asked before the conversation restarted. Never report an ingredient from it alone.

Background voices: report only what the main speaker says. Never report an ingredient mentioned only by a background voice.

Broken speech: if the sentence stops before any ingredient is named, reply exactly: "You were cut off. Please say that again." Do not call the tool.

Anything else: for greetings, questions, small talk or requests unrelated to ingredients running out, reply exactly: "Sorry, I can only take reports of ingredients that have run out." Do not continue the conversation.

Always reply in English, in one short sentence.`;

// Only shapes the worker's text on screen; the Realtime model hears the audio
// itself. Short, noisy clips otherwise drift into other languages.
const TRANSCRIPTION_PROMPT = `English speech from staff in a noisy Hong Kong style tea restaurant reporting ingredients that have run out, such as "we're out of honey". Ingredient names: ${INGREDIENTS.join(", ")}.`;

export const SESSION_CONFIG = {
  type: "realtime",
  model: "gpt-realtime-2.1-mini",
  output_modalities: ["text"],
  instructions: INSTRUCTIONS,
  max_output_tokens: 500,
  reasoning: { effort: "low" },
  tool_choice: "auto",
  tools: [
    {
      type: "function",
      name: REPORT_TOOL_NAME,
      description:
        "Record ingredients a worker has clearly reported as out. Only call this when each ingredient is certain.",
      parameters: {
        type: "object",
        properties: {
          ingredients: {
            type: "array",
            items: { type: "string", enum: INGREDIENTS },
            minItems: 1,
            description: "Every ingredient reported out in this turn.",
          },
        },
        required: ["ingredients"],
      },
    },
  ],
  audio: {
    input: {
      noise_reduction: { type: "near_field" },
      transcription: {
        model: "gpt-4o-mini-transcribe",
        language: "en",
        prompt: TRANSCRIPTION_PROMPT,
      },
      turn_detection: {
        type: "semantic_vad",
        eagerness: "low",
        create_response: true,
        interrupt_response: false,
      },
    },
  },
} as const;
