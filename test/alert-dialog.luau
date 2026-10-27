local harness = require("./lib/harness")
return {
	["alert dialog inherits Modal ownership selection close input and restoration"] = function()
		for _, destructive in { false, true } do
			for _, cancellable in { false, true } do
				local h = harness()
				local base = h.control("Base", "Base")
				h.select(base)
				local confirm, cancel
				local confirms, cancels, closes = 0, 0, 0
				local root, dispose = h.mount("Base", function()
					return h.require("alert-dialog").AlertDialog({
						name = "ConfirmPurchase",
						zIndex = 15,
						destructive = destructive,
						onConfirm = function()
							confirms += 1
						end,
						onCancel = if cancellable
							then function()
								cancels += 1
							end
							else nil,
						onClose = function()
							closes += 1
						end,
						children = function(dialog)
							confirm = h.instance("TextButton", "Base")
							h.require("use-press").usePress(dialog.confirm).action(confirm)
							if dialog.cancel then
								cancel = h.instance("TextButton", "Base")
								h.require("use-press").usePress(dialog.cancel).action(cancel)
							end
							return { confirm, cancel }
						end,
					})
				end)
				h.flush()
				assert(root.Name == "ConfirmPurchase" and root.ZIndex == 15, "placement reaches Modal")
				assert(h.runtime.modalOpen() and not base.Selectable and h.contexts.Menu, "dialog owns menu input")
				assert(
					h.gui.SelectedObject == (if destructive and cancellable then cancel else confirm),
					"initial dialog selection"
				)
				confirm.Activated:Fire()
				assert(confirms == 1, "spread confirm options activate")
				if cancel then
					cancel.Activated:Fire()
					assert(cancels == 1, "spread cancel options activate")
				end
				h.finish(h.begin(h.enum.KeyCode.ButtonB))
				assert(
					if cancellable then cancels == 2 and closes == 0 else closes == 1,
					"close uses cancel or fallback"
				)
				dispose()
				h.flush()
				assert(not h.runtime.modalOpen() and h.gui.SelectedObject == base, "dialog disposal restores selection")
				h.stop()
			end
		end
	end,
}
