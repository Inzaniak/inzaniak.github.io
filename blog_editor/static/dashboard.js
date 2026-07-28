(() => {
	"use strict";
	const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";
	document.querySelectorAll(".delete-draft").forEach((button) => {
		button.addEventListener("click", async () => {
			if (!window.confirm("Delete this local draft? Uploaded draft images will also be removed.")) return;
			button.disabled = true;
			const response = await fetch(`/api/drafts/${button.dataset.draftId}/delete`, {
				method: "POST",
				headers: {"X-CSRF-Token": csrf},
			});
			if (response.ok) window.location.reload();
			else {
				button.disabled = false;
				window.alert("The draft could not be deleted.");
			}
		});
	});
})();
