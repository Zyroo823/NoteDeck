import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantFrame } from "./FloatingAssistant";

function renderAssistant(pathname: string, userId?: string) {
  return renderToStaticMarkup(
    <AssistantFrame pageRef={{ current: null }} pathname={pathname} userId={userId} onNavigate={() => {}}>
      <main>NoteDeck page</main>
    </AssistantFrame>,
  );
}

test("public markup connects the accessible launcher to the dialog and offers guest help", () => {
  const html = renderAssistant("/sets/set-one");
  assert.match(html, /aria-label="Ask NoteDeck Assistant" aria-expanded="false" aria-controls="notedeck-assistant"/);
  assert.match(html, /<dialog id="notedeck-assistant" aria-labelledby="notedeck-assistant-title"/);
  assert.match(html, /What can I upload\?/);
  assert.match(html, /Sign in to ask about your materials/);
  assert.doesNotMatch(html, /Quiz me on this material/);
});

test("signed-in study views show grounded prompts, and the library is offered off material pages", () => {
  const guide = renderAssistant("/guides/guide-one", "owner");
  assert.match(guide, /Open study guide/);
  assert.match(guide, /Quiz me on this material/);
  assert.match(guide, /Messages and relevant study context are sent to Gemini/);
  assert.match(renderAssistant("/practice-test", "owner"), /Choose material from Library/);
});
