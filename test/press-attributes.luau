local harness = require("./lib/harness")
return {
	["attribute names are exported and frozen"] = function()
		local names = require("./lib/load")()("attributes").Attribute
		for _, name in { "Highlighted", "Pressed", "Disabled", "Selected", "Editing", "Invalid" } do
			assert(names[name] == name, "export matches instance attribute " .. name)
		end
		assert(table.isfrozen(names), "attribute contract cannot be mutated")
	end,
	["press release follows its input after cancellation and works for gamepad activation"] = function()
		local h = harness()
		local releases = 0
		local disabled = h.charm.atom(false)
		local button, dispose = h.press("Base", "Release", {
			disabled = disabled,
			onPress = function() end,
			onRelease = function()
				releases += 1
			end,
		})
		h.select(button)
		local input = h.begin(h.enum.KeyCode.ButtonA)
		assert(button:GetAttribute("Pressed") == true, "gamepad activation tracks pressed")
		disabled(true)
		assert(button:GetAttribute("Pressed") == false and releases == 0, "cancelling state does not release input")
		h.finish(input)
		h.finish(input)
		assert(releases == 1, "matching release fires once")
		disabled(false)
		local pointer = { UserInputType = h.enum.UserInputType.Touch }
		button.InputBegan:Fire(pointer)
		h.input.InputEnded:Fire({ UserInputType = h.enum.UserInputType.Touch })
		assert(releases == 1, "another input cannot release this press")
		dispose()
		h.input.InputEnded:Fire(pointer)
		assert(releases == 1, "disposal disconnects pending release")
		h.stop()
	end,
	["press attributes start false and follow hover press and disabled"] = function()
		local h = harness()
		h.device("Keyboard")
		local disabled = h.charm.atom(false)
		local calls = 0
		local button = h.press("Base", "Press", {
			disabled = disabled,
			onPress = function()
				calls += 1
			end,
		})
		for _, name in { "Highlighted", "Pressed", "Disabled" } do
			assert(button:GetAttribute(name) == false, name .. " starts false")
		end
		button.MouseEnter:Fire()
		assert(button:GetAttribute("Highlighted") == true, "hover highlights")
		local pointer = { UserInputType = h.enum.UserInputType.MouseButton1 }
		button.InputBegan:Fire(pointer)
		assert(button:GetAttribute("Pressed") == true, "pointer presses")
		h.input.InputEnded:Fire(pointer)
		assert(button:GetAttribute("Pressed") == false, "release clears pressed")
		button.Activated:Fire()
		assert(calls == 1, "activation reaches the game")
		button.InputBegan:Fire(pointer)
		disabled(true)
		assert(button:GetAttribute("Disabled") == true, "disabled reacts")
		assert(button:GetAttribute("Pressed") == false, "disabled cancels pressed")
		button.Activated:Fire()
		assert(calls == 1, "disabled blocks activation")
		button.MouseLeave:Fire()
		assert(button:GetAttribute("Highlighted") == false, "leave clears hover")
		disabled(false)
		assert(button:GetAttribute("Disabled") == false, "reenabled reacts")
		h.stop()
	end,
}
