(function () {
  "use strict";

  var elements = {
    heroVisual: document.getElementById("hero-visual"),
    runButton: document.getElementById("run-button"),
    runButtonLabel: document.getElementById("run-button-label"),
    runNote: document.getElementById("run-note"),
    runStatus: document.getElementById("run-status"),
    reportCard: document.querySelector(".report-card"),
    reportStamp: document.getElementById("report-stamp"),
    logList: document.getElementById("log-list"),
    logPlaceholder: document.getElementById("log-placeholder"),
    logStatus: document.getElementById("log-status"),
    reportEmpty: document.getElementById("report-empty"),
    reportError: document.getElementById("report-error"),
    reportErrorMessage: document.getElementById("report-error-message"),
    reportContent: document.getElementById("report-content"),
    summaryText: document.getElementById("summary-text"),
    findingsList: document.getElementById("findings-list"),
    findingCount: document.getElementById("finding-count"),
    rawReport: document.getElementById("raw-report"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    chatSend: document.getElementById("chat-send"),
    chatStatus: document.getElementById("chat-status"),
    chatMessages: document.getElementById("chat-messages"),
    stageItems: Array.prototype.slice.call(document.querySelectorAll(".stage-item"))
  };

  var stages = ["recon", "attack", "report"];
  var stageLabels = {
    recon: "RECON",
    attack: "ATTACK",
    report: "REPORT"
  };
  var state = {
    running: false,
    chatting: false
  };
  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  function wait(milliseconds) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, reducedMotionQuery.matches ? 0 : milliseconds);
    });
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function setRunStatus(label, tone) {
    setText(elements.runStatus, label);
    if (elements.runStatus) {
      elements.runStatus.dataset.tone = tone || "idle";
    }
  }

  function setStagesIdle() {
    elements.stageItems.forEach(function (item) {
      item.dataset.state = "idle";
      item.removeAttribute("aria-current");
    });
  }

  function setStageState(stage, stateName) {
    elements.stageItems.forEach(function (item) {
      if (item.dataset.stage === stage) {
        item.dataset.state = stateName;
        if (stateName === "current") {
          item.setAttribute("aria-current", "step");
        } else {
          item.removeAttribute("aria-current");
        }
      }
    });
  }

  function activateStage(stage) {
    var stageIndex = stages.indexOf(stage);
    if (stageIndex < 0) {
      stageIndex = 0;
    }

    stages.forEach(function (stageName, index) {
      if (index < stageIndex) {
        setStageState(stageName, "done");
      } else if (index === stageIndex) {
        setStageState(stageName, "current");
      } else {
        setStageState(stageName, "idle");
      }
    });
  }

  function finishStages() {
    stages.forEach(function (stageName) {
      setStageState(stageName, "done");
    });
  }

  function normalizeStage(value, index) {
    var normalized = String(value || "").toLowerCase();
    if (normalized.indexOf("recon") !== -1 || normalized.indexOf("discover") !== -1 || normalized.indexOf("map") !== -1) {
      return "recon";
    }
    if (normalized.indexOf("attack") !== -1 || normalized.indexOf("probe") !== -1 || normalized.indexOf("exploit") !== -1) {
      return "attack";
    }
    if (normalized.indexOf("report") !== -1 || normalized.indexOf("summar") !== -1 || normalized.indexOf("finding") !== -1) {
      return "report";
    }
    return stages[Math.min(Math.floor(index / 2), stages.length - 1)];
  }

  function normalizeLogEntry(entry, index) {
    var message = "";
    var stageHint = "";
    var level = "info";

    if (entry && typeof entry === "object") {
      stageHint = entry.stage || entry.phase || entry.type || entry.category || "";
      message = entry.message || entry.log || entry.text || entry.detail || entry.description || "";
      level = entry.level || entry.status || "info";
      if (!message) {
        try {
          message = JSON.stringify(entry);
        } catch (error) {
          message = "Event received.";
        }
      }
    } else {
      message = String(entry == null ? "Event received." : entry);
    }

    var stage = normalizeStage(stageHint + " " + message, index);
    var lowerLevel = String(level).toLowerCase();
    if (lowerLevel.indexOf("error") !== -1 || lowerLevel.indexOf("fail") !== -1) {
      level = "error";
    } else if (lowerLevel.indexOf("success") !== -1 || lowerLevel.indexOf("complete") !== -1 || lowerLevel.indexOf("pass") !== -1) {
      level = "success";
    } else {
      level = "info";
    }

    return {
      stage: stage,
      message: String(message),
      level: level
    };
  }

  function appendLog(entry, index) {
    if (elements.logPlaceholder && elements.logPlaceholder.parentNode) {
      elements.logPlaceholder.remove();
    }

    var normalized = normalizeLogEntry(entry, index);
    var row = document.createElement("li");
    var indexElement = document.createElement("span");
    var stageElement = document.createElement("span");
    var messageElement = document.createElement("span");

    row.className = "log-row";
    row.dataset.stage = normalized.stage;
    row.dataset.level = normalized.level;
    indexElement.className = "log-index";
    stageElement.className = "log-stage";
    messageElement.className = "log-message";
    setText(indexElement, String(index + 1).padStart(2, "0"));
    setText(stageElement, stageLabels[normalized.stage] || "EVENT");
    setText(messageElement, normalized.message);
    row.appendChild(indexElement);
    row.appendChild(stageElement);
    row.appendChild(messageElement);
    elements.logList.appendChild(row);

    window.requestAnimationFrame(function () {
      row.classList.add("is-visible");
      elements.logList.scrollTop = elements.logList.scrollHeight;
    });

    setText(elements.logStatus, stageLabels[normalized.stage] + " event: " + normalized.message);
    return normalized;
  }

  function appendSystemLog(message, level) {
    var index = elements.logList.querySelectorAll(".log-row").length;
    appendLog({ stage: "report", message: message, level: level || "info" }, index);
  }

  function resetRunView() {
    elements.logList.replaceChildren();
    elements.logList.appendChild(elements.logPlaceholder);
    setHidden(elements.reportEmpty, false);
    setHidden(elements.reportError, true);
    setHidden(elements.reportContent, true);
    setText(elements.reportErrorMessage, "The report could not be loaded.");
    setText(elements.reportStamp, "RUNNING");
    setText(elements.summaryText, "");
    elements.findingsList.replaceChildren();
    setHidden(elements.rawReport, true);
    setText(elements.rawReport, "");
    elements.reportCard.setAttribute("aria-busy", "true");
    setStagesIdle();
    activateStage("recon");
  }

  function getErrorMessage(error, fallback) {
    if (error && error.message) {
      return error.message;
    }
    return fallback;
  }

  async function readJson(response, endpointName) {
    var data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(endpointName + " returned invalid JSON.");
    }

    if (!response.ok) {
      var serverMessage = data && (data.error || data.message || data.reply);
      throw new Error(serverMessage || endpointName + " returned HTTP " + response.status + ".");
    }

    return data || {};
  }

  function valueToText(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback || "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return valueToText(item, "");
      }).filter(Boolean).join("\n");
    }
    if (typeof value === "object") {
      var preferred = value.text || value.message || value.summary || value.description;
      if (preferred) {
        return valueToText(preferred, fallback);
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return fallback || "Report data received.";
      }
    }
    return fallback || String(value);
  }

  function findingParts(finding) {
    if (finding && typeof finding === "object" && !Array.isArray(finding)) {
      return {
        title: finding.title || finding.name || finding.finding || "Observed finding",
        detail: finding.detail || finding.description || finding.message || finding.text || finding.evidence || "",
        severity: finding.severity || finding.priority || "",
        fix: Array.isArray(finding.fixes) ? finding.fixes : finding.fix || ""
      };
    }
    return {
      title: "Observed finding",
      detail: valueToText(finding, "Finding returned without detail."),
      severity: ""
    };
  }

  function extractFindings(report) {
    if (Array.isArray(report)) {
      return report;
    }
    if (report && typeof report === "object") {
      if (Array.isArray(report.findings)) {
        return report.findings;
      }
      if (Array.isArray(report.items)) {
        return report.items;
      }
      if (Array.isArray(report.results)) {
        return report.results;
      }
      if (Array.isArray(report.issues)) {
        return report.issues;
      }
    }
    return [];
  }

  function summaryToText(summary) {
    if (summary && typeof summary === "object" && !Array.isArray(summary)) {
      var severityKeys = ["critical", "high", "medium", "low"];
      var hasSeverityCounts = severityKeys.some(function (key) {
        return Object.prototype.hasOwnProperty.call(summary, key);
      });
      if (hasSeverityCounts) {
        return severityKeys.map(function (key) {
          return key.toUpperCase() + " " + String(summary[key] === undefined ? 0 : summary[key]);
        }).join("  /  ");
      }
    }
    return valueToText(summary, "Run complete. Review the returned findings.");
  }

  function renderReport(report, summary) {
    var summaryValue = summaryToText(summary);
    var findings = extractFindings(report);
    var reportText = "";

    if (typeof report === "string") {
      reportText = report;
    } else if (report && typeof report === "object" && !findings.length) {
      reportText = valueToText(report, "");
    }

    setText(elements.summaryText, summaryValue);
    elements.findingsList.replaceChildren();

    findings.forEach(function (finding, index) {
      var parts = findingParts(finding);
      var listItem = document.createElement("li");
      var number = document.createElement("span");
      var copy = document.createElement("p");
      var title = document.createElement("span");

      listItem.className = "finding-item";
      number.className = "finding-number";
      copy.className = "finding-copy";
      title.className = "finding-title";
      setText(number, String(index + 1).padStart(2, "0"));
      setText(title, valueToText(parts.title, "Observed finding"));
      if (parts.severity) {
        var severity = document.createElement("span");
        severity.className = "finding-severity";
        setText(severity, String(parts.severity).toUpperCase());
        title.appendChild(severity);
      }
      copy.appendChild(title);
      if (parts.detail) {
        var detail = document.createElement("span");
        detail.className = "finding-evidence";
        setText(detail, "Evidence: " + valueToText(parts.detail, ""));
        copy.appendChild(detail);
      }
      if (parts.fix) {
        var fix = document.createElement("span");
        fix.className = "finding-fix";
        setText(fix, "Fix: " + valueToText(parts.fix, ""));
        copy.appendChild(fix);
      }
      listItem.appendChild(number);
      listItem.appendChild(copy);
      elements.findingsList.appendChild(listItem);
    });

    if (!findings.length && !reportText) {
      var emptyFinding = document.createElement("li");
      emptyFinding.className = "finding-item";
      var emptyNumber = document.createElement("span");
      var emptyCopy = document.createElement("p");
      emptyNumber.className = "finding-number";
      emptyCopy.className = "finding-copy";
      setText(emptyNumber, "--");
      setText(emptyCopy, "No discrete findings were returned.");
      emptyFinding.appendChild(emptyNumber);
      emptyFinding.appendChild(emptyCopy);
      elements.findingsList.appendChild(emptyFinding);
    }

    setText(elements.findingCount, String(findings.length).padStart(2, "0") + " ITEMS");
    if (reportText) {
      setHidden(elements.rawReport, false);
      setText(elements.rawReport, reportText);
    } else {
      setHidden(elements.rawReport, true);
      setText(elements.rawReport, "");
    }
    setHidden(elements.reportEmpty, true);
    setHidden(elements.reportError, true);
    setHidden(elements.reportContent, false);
    setText(elements.reportStamp, "COMPLETE");
  }

  function showRunError(message) {
    setHidden(elements.reportEmpty, true);
    setHidden(elements.reportContent, true);
    setHidden(elements.reportError, false);
    setText(elements.reportErrorMessage, message);
    setText(elements.reportStamp, "ERROR");
    elements.reportCard.setAttribute("aria-busy", "false");
    setRunStatus("ERROR", "error");
    setText(elements.runNote, "The included weak bot did not return a usable run. Try again when ready.");
  }

  async function runRedTeam() {
    if (state.running) {
      return;
    }

    state.running = true;
    try {
      if (elements.heroVisual) {
        elements.heroVisual.dataset.runState = "active";
      }
      elements.runButton.disabled = true;
      setText(elements.runButtonLabel, "Running...");
      setText(elements.runNote, "Controlled run in progress. The included weak bot is the only target.");
      resetRunView();
      setRunStatus("RUNNING", "running");

      var response = await fetch("/api/red-team", {
        method: "POST"
      });
      var data = await readJson(response, "/api/red-team");
      var logs = Array.isArray(data.logs)
        ? data.logs
        : data.logs === undefined || data.logs === null
          ? []
          : [data.logs];

      if (!logs.length) {
        appendSystemLog("No event logs returned; rendering the report.", "info");
        await wait(240);
      } else {
        for (var index = 0; index < logs.length; index += 1) {
          var normalized = normalizeLogEntry(logs[index], index);
          activateStage(normalized.stage);
          appendLog(logs[index], index);
          await wait(260);
        }
      }

      activateStage("report");
      setRunStatus("REPORTING", "running");
      setText(elements.logStatus, "REPORT: compiling returned findings.");
      await wait(220);
      renderReport(
        data.report || data.findings,
        data.summary || (data.report && data.report.summary)
      );
      finishStages();
      setRunStatus("COMPLETE", "success");
      setText(elements.runNote, "Run complete. Results are limited to the included weak bot.");
      elements.reportCard.setAttribute("aria-busy", "false");
    } catch (error) {
      var message = getErrorMessage(error, "The red-team request failed.");
      appendSystemLog(message, "error");
      setStageState("report", "error");
      showRunError(message);
    } finally {
      if (elements.heroVisual) {
        elements.heroVisual.dataset.runState = "idle";
      }
      state.running = false;
      elements.runButton.disabled = false;
      setText(elements.runButtonLabel, "Run red team");
    }
  }

  function appendChatMessage(role, text, isError) {
    var message = document.createElement("div");
    var meta = document.createElement("span");
    var paragraph = document.createElement("p");
    message.className = "chat-message " + (role === "user" ? "user-message" : "assistant-message");
    if (isError) {
      message.classList.add("error-message");
    }
    meta.className = "message-meta";
    paragraph.className = "message-copy";
    setText(meta, role === "user" ? "YOU / OPERATOR" : "BOT / SUPPORT");
    setText(paragraph, text);
    message.appendChild(meta);
    message.appendChild(paragraph);
    elements.chatMessages.appendChild(message);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  async function sendChatMessage(message) {
    state.chatting = true;
    elements.chatSend.disabled = true;
    elements.chatInput.disabled = true;
    setText(elements.chatStatus, "POST /api/chat · waiting for the included weak bot");

    try {
      var response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ message: message })
      });
      var data = await readJson(response, "/api/chat");
      var reply = valueToText(data.reply, "The included weak bot returned no reply.");
      appendChatMessage("assistant", reply, false);
      setText(elements.chatStatus, "POST /api/chat · included weak bot");
    } catch (error) {
      var errorMessage = getErrorMessage(error, "The support request failed.");
      appendChatMessage("assistant", errorMessage, true);
      setText(elements.chatStatus, "POST /api/chat · request failed");
    } finally {
      state.chatting = false;
      elements.chatSend.disabled = false;
      elements.chatInput.disabled = false;
      elements.chatInput.focus();
    }
  }

  elements.runButton.addEventListener("click", runRedTeam);
  elements.chatForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.chatting) {
      return;
    }
    var message = elements.chatInput.value.trim();
    if (!message) {
      elements.chatInput.focus();
      return;
    }
    appendChatMessage("user", message, false);
    elements.chatInput.value = "";
    sendChatMessage(message);
  });
})();
