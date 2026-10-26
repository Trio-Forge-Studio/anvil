local harness = require("./lib/harness")
local function setup()
	local h = harness()
	local module = h.require("dialog")
	h.Dialog, h.AlertDialog = module.Dialog, module.AlertDialog
	return h
end
local function pressB(h)
	h.finish(h.begin(h.enum.KeyCode.ButtonB))
end
return {
	["dialog and alert dialog parts outside their root raise a named error"] = function()
		local h = setup()
		for _, case in
			{
				{ h.Dialog, "Dialog", "Trigger" },
				{ h.Dialog, "Dialog", "Content" },
				{ h.Dialog, "Dialog", "Close" },
				{ h.AlertDialog, "AlertDialog", "Content" },
				{ h.AlertDialog, "AlertDialog", "Action" },
				{ h.AlertDialog, "AlertDialog", "Cancel" },
			}
		do
			local parts, root, part = case[1], case[2], case[3]
			local ok, message = pcall(function()
				h.mount("Base", function()
					return parts[part]({ children = function() end })
				end)
			end)
			local expected = `{root}.{part} must be used inside {root}.Root`
			assert(not ok and string.find(message, expected, 1, true), `{root}.{part}: {message}`)
		end
		h.stop()
	end,
	["the trigger opens a trapped dialog, close input and Close dismiss it, and selection returns to the trigger"] = function()
		local h = setup()
		local reported = {}
		local trigger, close, content, binding
		local mounts = 0
		h.mount("Base", function()
			return h.Dialog.Root({
				onOpenChange = function(open)
					table.insert(reported, open)
				end,
				children = function(dialog)
					binding = dialog
					trigger = h.Dialog.Trigger({ Name = "Open" })
					return {
						trigger,
						h.Dialog.Content({
							Name = "Settings",
							children = function()
								mounts += 1
								local other = h.vide.jsx("textbutton", { action = h.runtime.useSelection({}).action })
								close = h.Dialog.Close({ Name = "Close" })
								content = h.vide.jsx("frame", {}, other, close)
								return content
							end,
						}),
					}
				end,
			})
		end)
		h.flush()
		assert(mounts == 0 and not h.runtime.modalOpen(), "closed content stays unmounted")
		h.select(trigger)
		trigger.Activated:Fire()
		h.flush()
		assert(binding.open() and reported[1] == true and mounts == 1, "the trigger opens the dialog")
		assert(h.runtime.modalOpen() and not trigger.Selectable, "the content traps selection")
		assert(h.gui.SelectedObject == close, "the Close part is the fallback selection over earlier controls")
		pressB(h)
		h.flush()
		assert(not binding.open() and reported[2] == false, "close input closes")
		assert(h.gui.SelectedObject == trigger, "selection returns to the trigger")
		trigger.Activated:Fire()
		h.flush()
		close.Activated:Fire()
		h.flush()
		assert(not binding.open() and #reported == 4 and mounts == 2, "Close closes and content remounts per open")
		assert(h.gui.SelectedObject == trigger, "Close also restores the trigger")
		h.stop()
	end,
	["a controlled dialog only reports and an asChild content child becomes the trapped root"] = function()
		local h = setup()
		local open = h.vide.source(true)
		local requests = 0
		local panel
		h.mount("Base", function()
			return h.Dialog.Root({
				open = open,
				onOpenChange = function()
					requests += 1
				end,
				children = function()
					return h.Dialog.Content({
						asChild = true,
						children = function()
							panel = h.vide.jsx("frame", { Name = "Panel" }, h.Dialog.Close({}))
							return { panel, h.vide.jsx("uicorner", {}) }
						end,
					})
				end,
			})
		end)
		h.flush()
		assert(panel.SelectionGroup == true and h.runtime.modalOpen(), "the child is the trapped root")
		pressB(h)
		h.flush()
		assert(requests == 1 and h.runtime.modalOpen(), "a controlled dialog stays open until the owner closes it")
		open(false)
		h.flush()
		assert(not h.runtime.modalOpen(), "the owner closes it")
		h.stop()
	end,
	["an alert dialog selects Action first, or Cancel when destructive, and an Action can refuse"] = function()
		for _, destructive in { false, true } do
			local h = setup()
			local open = h.vide.source(true)
			local allow, actions, cancels = false, 0, 0
			local action, cancel
			h.mount("Base", function()
				return h.AlertDialog.Root({
					open = open,
					onOpenChange = open,
					destructive = destructive,
					children = function()
						return h.AlertDialog.Content({
							children = function()
								cancel = h.AlertDialog.Cancel({
									onPress = function()
										cancels += 1
									end,
								})
								action = h.AlertDialog.Action({
									onPress = function()
										actions += 1
										return allow
									end,
								})
								return { cancel, action }
							end,
						})
					end,
				})
			end)
			h.flush()
			assert(h.gui.SelectedObject == (if destructive then cancel else action), `destructive={destructive}`)
			action.Activated:Fire()
			assert(actions == 1 and open() and h.feedback[#h.feedback] == "Refused", "a refused action stays open")
			allow = true
			action.Activated:Fire()
			assert(actions == 2 and not open(), "an allowed action closes")
			open(true)
			h.flush()
			cancel.Activated:Fire()
			assert(cancels == 1 and not open(), "Cancel runs onPress and closes")
			open(true)
			h.flush()
			pressB(h)
			assert(not open() and cancels == 1 and actions == 2, "close input closes without either onPress")
			h.stop()
		end
	end,
}
