/**
 * jsPsych plugin: form-page
 * -------------------------------------------------------------
 * A small, general-purpose form screen for jsPsych 8.
 *
 *  - `html` is any form markup (inputs, radios, checkboxes, selects).
 *  - `validate(values, form)` may return
 *        null                 -> accept
 *        { error: "message" } -> block; show message; let participant fix it
 *        { warn:  "message" } -> soft check; participant may "Go back" or
 *                                "Continue anyway" (used so that every
 *                                question can be skipped, as the IRB requires,
 *                                without blanks happening by accident)
 *  - `transform(values, form)` turns the raw form values into what is stored
 *    as `response`. Use it to keep identifying text OUT of the data.
 *  - `on_render(form)` lets the experiment attach live behaviour (e.g. a
 *    diagram that updates as the participant answers).
 *
 * The plugin never records the page HTML, only `response` (after transform),
 * `rt`, and counters for blocked / soft-warned submissions.
 */
var jsPsychFormPage = (function (jspsych) {
  "use strict";

  const info = {
    name: "form-page",
    version: "1.0.0",
    parameters: {
      html: { type: jspsych.ParameterType.HTML_STRING, default: undefined },
      button_label: { type: jspsych.ParameterType.STRING, default: "Continue" },
      validate: { type: jspsych.ParameterType.FUNCTION, default: null },
      transform: { type: jspsych.ParameterType.FUNCTION, default: null },
      on_render: { type: jspsych.ParameterType.FUNCTION, default: null },
      warn_continue_label: { type: jspsych.ParameterType.STRING, default: "Continue anyway" },
      warn_back_label: { type: jspsych.ParameterType.STRING, default: "Go back" },
    },
    data: {
      response: { type: jspsych.ParameterType.OBJECT },
      rt: { type: jspsych.ParameterType.INT },
      n_blocked_submits: { type: jspsych.ParameterType.INT },
      n_soft_warnings: { type: jspsych.ParameterType.INT },
    },
  };

  function readForm(form) {
    const out = {};
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.name) return;
      if (el.type === "radio") {
        if (!(el.name in out)) out[el.name] = null;
        if (el.checked) out[el.name] = el.value;
      } else if (el.type === "checkbox") {
        if (!Array.isArray(out[el.name])) out[el.name] = [];
        if (el.checked) out[el.name].push(el.value);
      } else {
        const v = (el.value || "").trim();
        out[el.name] = v === "" ? null : v;
      }
    });
    return out;
  }

  class FormPagePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    static {
      this.info = info;
    }

    trial(display_element, trial) {
      const t0 = performance.now();
      let nBlocked = 0;
      let nWarn = 0;

      display_element.innerHTML =
        '<form id="fp-form" class="fp-form" autocomplete="off" novalidate>' +
        trial.html +
        '<div id="fp-msg" class="fp-msg" role="alert" aria-live="assertive"></div>' +
        '<div class="fp-actions"><button type="submit" id="fp-submit" class="jspsych-btn fp-primary">' +
        trial.button_label +
        "</button></div></form>";

      const form = display_element.querySelector("#fp-form");
      const msg = display_element.querySelector("#fp-msg");
      const submitBtn = display_element.querySelector("#fp-submit");

      if (typeof trial.on_render === "function") trial.on_render(form);

      const clearMsg = () => {
        msg.innerHTML = "";
        msg.className = "fp-msg";
        submitBtn.style.display = "";
      };
      form.addEventListener("input", () => {
        if (msg.classList.contains("fp-error")) clearMsg();
      });

      const finish = (values) => {
        const response =
          typeof trial.transform === "function" ? trial.transform(values, form) : values;
        const rt = Math.round(performance.now() - t0);
        display_element.innerHTML = "";
        this.jsPsych.finishTrial({
          response: response,
          rt: rt,
          n_blocked_submits: nBlocked,
          n_soft_warnings: nWarn,
        });
      };

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const values = readForm(form);
        const verdict =
          typeof trial.validate === "function" ? trial.validate(values, form) : null;

        if (verdict && verdict.error) {
          nBlocked++;
          msg.className = "fp-msg fp-error";
          msg.innerHTML = verdict.error;
          msg.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (verdict && verdict.warn) {
          nWarn++;
          msg.className = "fp-msg fp-warn";
          msg.innerHTML =
            "<p>" + verdict.warn + "</p>" +
            '<div class="fp-warn-actions">' +
            '<button type="button" class="jspsych-btn" id="fp-back">' + trial.warn_back_label + "</button>" +
            '<button type="button" class="jspsych-btn" id="fp-go">' + trial.warn_continue_label + "</button>" +
            "</div>";
          submitBtn.style.display = "none";
          msg.querySelector("#fp-back").addEventListener("click", clearMsg);
          msg.querySelector("#fp-go").addEventListener("click", () => finish(readForm(form)));
          msg.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        finish(values);
      });
    }
  }

  return FormPagePlugin;
})(jsPsychModule);
