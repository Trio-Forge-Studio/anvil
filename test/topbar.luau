local harness = require("./lib/harness")
local function icon(h, given)
	local button = h.instance("TextButton", "Topbar")
	local binding, dispose = h.mount("Base", function()
		local result = h.require("use-topbar-icon").useTopbarIcon(given)
		result.action(button)
		return result
	end)
	return button, binding, dispose
end
return {
	["top bar icon attributes follow hover selected disabled and notice"] = function()
		local h = harness()
		h.device("Keyboard")
		local selected = h.charm.atom(false)
		local disabled = h.charm.atom(false)
		local notice = h.charm.atom(false :: any)
		local calls = 0
		local button = icon(h, {
			selected = selected,
			disabled = disabled,
			notice = notice,
			onPress = function()
				calls += 1
			end,
		})
		for _, name in { "Highlighted", "Pressed", "Disabled", "Selected" } do
			assert(button:GetAttribute(name) == false, name .. " starts false")
		end
		assert(button:GetAttribute("Notice") == 0, "notice starts at zero")
		button.MouseEnter:Fire()
		assert(button:GetAttribute("Highlighted") == true, "hover highlights")
		selected(true)
		assert(button:GetAttribute("Selected") == true, "controlled selection reaches styling")
		notice(true)
		assert(button:GetAttribute("Notice") == 1, "a boolean notice counts as one")
		notice(120)
		assert(button:GetAttribute("Notice") == 120, "a numeric notice keeps its count")
		disabled(true)
		button.Activated:Fire()
		assert(button:GetAttribute("Disabled") == true and calls == 0, "disabled icon refuses")
		h.stop()
	end,
	["top bar icon presses while a modal is open and refuses while the Roblox menu is open"] = function()
		local h = harness()
		local calls, hud = 0, 0
		local button = icon(h, {
			selected = false,
			onPress = function()
				calls += 1
			end,
		})
		local base = h.press("Base", "Hud", {
			onPress = function()
				hud += 1
			end,
		})
		assert(button.Selectable, "play mode lets the gamepad reach the icon")
		local screen = h.root(10)
		local inside = h.control(screen, "Inside", { selectFirst = true })
		h.flush()
		base.Activated:Fire()
		button.Activated:Fire()
		assert(hud == 0 and calls == 1, "the icon presses above a modal that blocks the HUD")
		assert(not button.Selectable and h.gui.SelectedObject == inside, "the modal keeps gamepad selection")
		h.gui.MenuIsOpen = true
		button.Activated:Fire()
		assert(calls == 1, "the Roblox menu blocks the icon")
		h.gui.MenuIsOpen = false
		h.runtime.closeRoot(screen)
		button.Activated:Fire()
		assert(calls == 2 and button.Selectable, "the icon presses again in play mode")
		h.stop()
	end,
	["top bar icon never changes its own selected state"] = function()
		local h = harness()
		local selected = h.charm.atom(false)
		local button, binding = icon(h, {
			selected = selected,
			onPress = function() end,
		})
		button.Activated:Fire()
		button.Activated:Fire()
		assert(not binding.selected() and button:GetAttribute("Selected") == false, "presses leave selection alone")
		selected(true)
		button.Activated:Fire()
		assert(binding.selected() and button:GetAttribute("Selected") == true, "the game decides selection")
		h.stop()
	end,
	["top bar caption shows after half a second of mouse hover and hides when selected"] = function()
		local h = harness()
		h.device("Keyboard")
		local selected = h.charm.atom(false)
		local button, binding = icon(h, { selected = selected, caption = "Settings", onPress = function() end })
		button.MouseEnter:Fire()
		h.tick(0.4)
		assert(not binding.captionShown(), "the caption waits for the hover delay")
		h.tick(0.1)
		assert(binding.captionShown(), "the caption shows after half a second")
		selected(true)
		assert(not binding.captionShown(), "a selected icon hides its caption")
		selected(false)
		button.MouseLeave:Fire()
		assert(not binding.captionShown(), "leaving hides the caption")
		button.MouseEnter:Fire()
		h.tick(0.3)
		assert(not binding.captionShown(), "a new hover restarts the delay")
		button.MouseLeave:Fire()
		h.device("Touch")
		button.MouseEnter:Fire()
		h.tick(1)
		assert(not binding.captionShown(), "touch never shows the caption")
		h.device("Gamepad")
		h.select(button)
		h.flush()
		h.tick(1)
		assert(not binding.captionShown(), "gamepad selection never shows the caption")
		h.stop()
	end,
}
