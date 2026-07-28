(() => {
	"use strict";
	const initial = JSON.parse(document.querySelector("#initial-article").textContent);
	let draftId = JSON.parse(document.querySelector("#initial-draft").textContent);
	const csrf = document.querySelector('meta[name="csrf-token"]').content;
	const form = document.querySelector("#article-form");
	const editor = document.querySelector("#rich-editor");
	const source = document.querySelector("#source-editor");
	const saveStatus = document.querySelector("#save-status");
	const message = document.querySelector("#message");
	const publishButton = document.querySelector("#publish-button");
	const slugInput = document.querySelector("#slug");
	let sourceMode = false;
	let saveTimer = null;
	let saving = null;
	let slugTouched = Boolean(initial.slug);

	editor.innerHTML = initial.content || "<p>Start writing…</p>";
	source.value = editor.innerHTML;

	const slugify = (value) => value.toLowerCase().trim()
		.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

	const articleData = () => ({
		original_path: initial.original_path || "",
		heading: document.querySelector("#heading").value,
		seo_title: document.querySelector("#seo_title").value,
		slug: slugInput.value,
		date: document.querySelector("#date").value,
		categories: document.querySelector("#categories").value.split(",").map(v => v.trim()).filter(Boolean),
		deck: document.querySelector("#deck").value,
		summary: document.querySelector("#summary").value,
		description: document.querySelector("#description").value,
		keywords: document.querySelector("#keywords").value,
		image: document.querySelector("#image").value,
		content: sourceMode ? source.value : editor.innerHTML,
	});

	const showMessage = (kind, text, details = "") => {
		message.className = `message ${kind}`;
		message.replaceChildren();
		const title = document.createElement("strong");
		title.textContent = text;
		message.append(title);
		if (details) {
			const pre = document.createElement("pre");
			pre.textContent = details;
			message.append(pre);
		}
		message.hidden = false;
		message.scrollIntoView({behavior: "smooth", block: "nearest"});
	};

	const saveDraft = async () => {
		saveStatus.textContent = "Saving…";
		saving = fetch("/api/drafts", {
			method: "POST",
			headers: {"Content-Type": "application/json", "X-CSRF-Token": csrf},
			body: JSON.stringify({draft_id: draftId, data: articleData()}),
		}).then(async (response) => {
			const result = await response.json();
			if (!response.ok) throw new Error("Draft save failed");
			draftId = result.draft_id;
			saveStatus.textContent = "Draft saved";
			return result;
		}).catch(() => {
			saveStatus.textContent = "Could not save";
		}).finally(() => {
			saving = null;
		});
		return saving;
	};

	const scheduleSave = () => {
		saveStatus.textContent = "Unsaved changes";
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(saveDraft, 900);
		updatePreview();
	};

	const updatePreview = () => {
		document.querySelector("#preview-heading").textContent =
			document.querySelector("#heading").value || "Your headline";
		document.querySelector("#preview-kicker").textContent =
			document.querySelector("#categories").value.split(",").map(v => v.trim()).filter(Boolean).join(" / ");
		document.querySelector("#preview-deck").textContent =
			document.querySelector("#deck").value || "Your article deck will appear here.";
		document.querySelector("#preview-body").innerHTML = sourceMode ? source.value : editor.innerHTML;
		document.querySelector("#slug-preview").textContent = slugInput.value || "my-article-title";
	};

	form.addEventListener("input", (event) => {
		if (event.target.id === "heading" && !slugTouched && !slugInput.readOnly) {
			slugInput.value = slugify(event.target.value);
		}
		if (event.target.id === "slug") slugTouched = true;
		scheduleSave();
	});

	document.querySelectorAll("[data-command]").forEach((button) => {
		button.addEventListener("click", () => {
			editor.focus();
			document.execCommand(button.dataset.command, false);
			scheduleSave();
		});
	});

	document.querySelector("#block-format").addEventListener("change", (event) => {
		editor.focus();
		document.execCommand("formatBlock", false, event.target.value);
		scheduleSave();
	});

	document.querySelector("#link-button").addEventListener("click", () => {
		const url = window.prompt("Link URL (https://… or /site-path):");
		if (!url) return;
		editor.focus();
		document.execCommand("createLink", false, url);
		scheduleSave();
	});

	document.querySelector("#source-toggle").addEventListener("click", (event) => {
		sourceMode = !sourceMode;
		if (sourceMode) {
			source.value = editor.innerHTML;
			editor.hidden = true;
			source.hidden = false;
			event.target.textContent = "Rich text";
		} else {
			editor.innerHTML = source.value;
			source.hidden = true;
			editor.hidden = false;
			event.target.textContent = "HTML source";
		}
		scheduleSave();
	});

	const ensureDraft = async () => {
		if (!draftId) await saveDraft();
		else if (saving) await saving;
		if (!draftId) throw new Error("Save the draft before uploading.");
	};

	const uploadImage = async (file) => {
		await ensureDraft();
		const data = new FormData();
		data.append("draft_id", draftId);
		data.append("file", file);
		const response = await fetch("/api/uploads", {
			method: "POST",
			headers: {"X-CSRF-Token": csrf},
			body: data,
		});
		const result = await response.json();
		if (!response.ok) throw new Error((result.errors || ["Upload failed."]).join(" "));
		return result.url;
	};

	document.querySelector("#cover-upload").addEventListener("change", async (event) => {
		const file = event.target.files[0];
		if (!file) return;
		try {
			saveStatus.textContent = "Uploading…";
			document.querySelector("#image").value = await uploadImage(file);
			scheduleSave();
		} catch (error) {
			showMessage("error", error.message);
		}
		event.target.value = "";
	});

	document.querySelector("#body-upload").addEventListener("change", async (event) => {
		const file = event.target.files[0];
		if (!file) return;
		try {
			saveStatus.textContent = "Uploading…";
			const url = await uploadImage(file);
			editor.focus();
			document.execCommand("insertImage", false, url);
			const images = editor.querySelectorAll(`img[src="${CSS.escape(url)}"]`);
			const image = images[images.length - 1];
			if (image) {
				image.alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
				image.loading = "lazy";
			}
			scheduleSave();
		} catch (error) {
			showMessage("error", error.message);
		}
		event.target.value = "";
	});

	publishButton.addEventListener("click", async () => {
		window.clearTimeout(saveTimer);
		publishButton.disabled = true;
		publishButton.textContent = "Validating…";
		message.hidden = true;
		try {
			await ensureDraft();
			const response = await fetch("/api/publish", {
				method: "POST",
				headers: {"Content-Type": "application/json", "X-CSRF-Token": csrf},
				body: JSON.stringify({draft_id: draftId, data: articleData()}),
			});
			const result = await response.json();
			if (!response.ok) {
				showMessage("error", (result.errors || ["Publish failed."]).join(" "), result.build_output || "");
				return;
			}
			showMessage("success", `Published ${result.path}`, "Jekyll validation passed.");
			saveStatus.textContent = "Published";
			window.setTimeout(() => { window.location.href = "/"; }, 1200);
		} catch (error) {
			showMessage("error", error.message || "Publish failed.");
		} finally {
			publishButton.disabled = false;
			publishButton.textContent = "Publish & validate";
		}
	});

	window.addEventListener("beforeunload", () => {
		if (saveStatus.textContent === "Unsaved changes") saveDraft();
	});

	updatePreview();
})();
