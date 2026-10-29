import { expect, test, type Page } from "@playwright/test";

// Headless Chromium has no speech service, so the page gets a fake recognizer that
// the test drives with window.__speech (emit a phrase, fail with a code, end).
// Supabase Auth and the backend are mocked, so no real account or microphone is needed.

const userId = "00000000-0000-0000-0000-000000000015";

const savedProfile = {
  fullName: "Ana García",
  email: "ana@example.test",
  phone: "",
  location: "Buenos Aires",
  linkedin: "",
  website: "",
  photoPath: null,
};

const generatedCv = {
  personalInfo: { ...savedProfile, email: "ana@example.com" },
  summary: "Diseñadora de producto.",
  experience: [],
  education: [],
  skills: { hard: ["Figma"], soft: [] },
  languages: [],
  certifications: [],
};

type SpeechControl = {
  instances: number;
  started: number;
  stopped: number;
  aborted: number;
  lang: string;
  emit: (transcript: string, isFinal: boolean) => void;
  fail: (code: string) => void;
  end: () => void;
};

async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Handler<T> = ((event: T) => void) | null;
    const control = {
      instances: 0,
      started: 0,
      stopped: 0,
      aborted: 0,
      lang: "",
      current: null as FakeRecognition | null,
      emit(transcript: string, isFinal: boolean) {
        const result = Object.assign([{ transcript }], { isFinal });
        control.current?.onresult?.({ resultIndex: 0, results: [result] });
      },
      fail(code: string) {
        control.current?.onerror?.({ error: code });
      },
      end() {
        control.current?.onend?.(undefined);
      },
    };
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Handler<unknown> = null;
      onerror: Handler<unknown> = null;
      onend: Handler<undefined> = null;
      constructor() {
        control.instances += 1;
        control.current = this;
      }
      start() {
        control.started += 1;
        control.lang = this.lang;
      }
      stop() {
        control.stopped += 1;
        // Real browsers end shortly after stop().
        setTimeout(() => this.onend?.(undefined), 0);
      }
      abort() {
        control.aborted += 1;
      }
    }
    // Recent Chromium also ships the unprefixed SpeechRecognition, which the app prefers.
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, key, { configurable: true, writable: true, value: FakeRecognition });
    }
    Object.assign(window, { __speech: control });
  });
}

const speech = <T,>(page: Page, read: (control: SpeechControl) => T) =>
  page.evaluate(`(${read.toString()})(window.__speech)`) as Promise<T>;

async function installMocks(page: Page) {
  await page.route("**/auth/v1/token**", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: `synthetic-voice-${userId}`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "synthetic-voice-refresh",
        user: {
          id: userId,
          email: savedProfile.email,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedProfile) }),
  );
  const generateBodies: string[] = [];
  await page.route("**/api/generate-cv", async (route) => {
    generateBodies.push((route.request().postDataJSON() as { text: string }).text);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(generatedCv) });
  });
  await page.route("**/api/trajectory-assistance/turn", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        state: "needs_input",
        questions: [
          { id: "q-team", text: "¿Cuántas personas tenía tu equipo?" },
          { id: "q-metric", text: "¿Qué cifra podés confirmar?" },
        ],
      }),
    }),
  );
  return { generateBodies };
}

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(savedProfile.email);
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // The first visit compiles /generate in dev mode, which can take a while.
  await expect(page).toHaveURL(/\/generate$/, { timeout: 30_000 });
}

test.describe("Dictado por voz", () => {
  test("dicta la experiencia al final del texto y se detiene al tocar de nuevo", async ({ page }) => {
    await installFakeSpeech(page);
    await installMocks(page);
    await signIn(page);

    const field = page.getByTestId("professional-text");
    const mic = page.getByRole("button", { name: "Dictar por voz en Biografía o experiencia profesional" });
    await field.fill("Soy diseñadora de producto.");
    await mic.click();

    const stop = page.getByRole("button", { name: "Detener dictado en Biografía o experiencia profesional" });
    await expect(stop).toHaveAttribute("aria-pressed", "true");
    expect(await speech(page, (control) => control.lang)).toBe("es-AR");

    await speech(page, (control) => control.emit("Trabajé cinco años", false));
    await expect(page.getByTestId("voice-input-status-professional-text")).toContainText("Trabajé cinco años");
    await expect(field).toHaveValue("Soy diseñadora de producto.");

    await speech(page, (control) => control.emit("Trabajé cinco años en Acme", true));
    await expect(field).toHaveValue("Soy diseñadora de producto. Trabajé cinco años en Acme");
    await expect(page.getByText(/^54 caracteres$/)).toBeVisible();

    await stop.click();
    await expect(mic).toHaveAttribute("aria-pressed", "false");
    expect(await speech(page, (control) => control.stopped)).toBe(1);
  });

  test("generar el CV durante el dictado apaga el micrófono y usa el texto dictado", async ({ page }) => {
    await installFakeSpeech(page);
    const mocks = await installMocks(page);
    await signIn(page);

    await page.getByTestId("voice-input-professional-text").click();
    await speech(page, (control) => control.emit("Ana es diseñadora y usa Figma", true));
    await page.getByTestId("generate-submit").click();

    await expect(page.getByTestId("voice-input-professional-text")).toBeDisabled();
    expect(await speech(page, (control) => control.aborted)).toBe(1);
    await expect(page.getByTestId("cv-preview")).toBeVisible();
    expect(mocks.generateBodies[0]).toContain("Ana es diseñadora y usa Figma");
    await expect(page.getByTestId("voice-input-professional-text")).toHaveAttribute("aria-pressed", "false");
  });

  test("explica en rioplatense si no se dio permiso al micrófono", async ({ page }) => {
    await installFakeSpeech(page);
    await installMocks(page);
    await signIn(page);

    await page.getByTestId("voice-input-professional-text").click();
    await speech(page, (control) => {
      control.fail("not-allowed");
      control.end();
    });

    await expect(page.getByTestId("voice-input-error-professional-text")).toContainText(
      "No diste permiso para usar el micrófono",
    );
    await page.getByTestId("professional-text").fill("Sigo escribiendo");
    await expect(page.getByTestId("professional-text")).toHaveValue("Sigo escribiendo");
  });

  test("dicta una respuesta del asistente solo en esa respuesta", async ({ page }) => {
    await installFakeSpeech(page);
    await installMocks(page);
    await signIn(page);

    await page.getByTestId("professional-text").fill("Lideré un equipo de soporte y reduje incidencias.");
    await page.getByTestId("trajectory-assistance-open").click();
    await expect(page.getByTestId("trajectory-assistant")).toBeVisible();

    await page.getByRole("button", { name: "Dictar por voz en ¿Cuántas personas tenía tu equipo?" }).click();
    await speech(page, (control) => control.emit("Éramos ocho personas", true));

    await expect(page.getByTestId("trajectory-answer-q-team")).toHaveValue("Éramos ocho personas");
    await expect(page.getByTestId("trajectory-answer-q-metric")).toHaveValue("");

    // Starting another field's dictation stops the first one.
    await page.getByTestId("voice-input-trajectory-answer-q-metric").click();
    await expect(page.getByTestId("voice-input-trajectory-answer-q-team")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("voice-input-trajectory-answer-q-metric")).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Cerrar asistencia" }).click();
    await expect(page.getByTestId("trajectory-assistant")).toHaveCount(0);
    expect(await speech(page, (control) => control.aborted)).toBe(2);
  });

  test("sin dictado en el navegador no aparece el micrófono", async ({ page }) => {
    // Like Firefox: Chromium ships webkitSpeechRecognition, so it is removed here.
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
      Reflect.deleteProperty(window, "SpeechRecognition");
    });
    await installMocks(page);
    await signIn(page);

    await expect(page.getByTestId("professional-text")).toBeVisible();
    await expect(page.getByTestId("voice-input-professional-text")).toHaveCount(0);
  });
});
