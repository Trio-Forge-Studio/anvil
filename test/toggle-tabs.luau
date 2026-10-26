local harness = require("./lib/harness")
return {
	["toggle reads controlled state and changes it only on an enabled press"] = function()
		local h = harness()
		local on = h.charm.atom(false)
		local disabled = h.charm.atom(false)
		local calls = 0
		local button = h.instance("TextButton", "Base")
		local binding = h.mount("Base", function()
			local toggle = h.require("use-toggle").useToggle({
				on = on,
				disabled = disabled,
				silent = true,
				onToggle = function(value)
					calls += 1
					on(value)
				end,
			})
			toggle.action(button)
			return toggle
		end)
		assert(not binding.on() and button:GetAttribute("Selected") == false, "unselected starts explicit")
		button.Activated:Fire()
		assert(binding.on() and button:GetAttribute("Selected") == true and calls == 1, "press toggles on")
		on(false)
		assert(button:GetAttribute("Selected") == false, "external controlled changes update styling")
		disabled(true)
		button.Activated:Fire()
		assert(calls == 1 and button:GetAttribute("Disabled") == true, "disabled toggle refuses")
		assert(#h.feedback == 0, "silent suppresses feedback")
		h.stop()
	end,
	["tabs bind in child scopes select first and skip reselection"] = function()
		local h = harness()
		local owner = h.root(10)
		local selected = h.charm.atom(1)
		local disabled = h.charm.atom(false)
		local calls = 0
		local tabs = h.require("use-tabs").useTabs({
			selected = selected,
			onSelect = function(index)
				calls += 1
				selected(index)
			end,
		})
		local first = h.instance("TextButton", owner)
		local second = h.instance("TextButton", owner)
		local firstTab = h.mount(owner, function()
			local tab = tabs.tab(1, { selectFirst = true })
			tab.action(first)
			return tab
		end)
		local secondTab, remove = h.mount(owner, function()
			local tab = tabs.tab(2, { disabled = disabled })
			tab.action(second)
			return tab
		end)
		h.flush()
		assert(h.gui.SelectedObject == first, "tab scope inherits modal selection")
		assert(first:GetAttribute("Selected") == true and second:GetAttribute("Selected") == false, "initial selection")
		first.Activated:Fire()
		assert(calls == 0, "selected tab does not reselect")
		second.Activated:Fire()
		assert(calls == 1 and not firstTab.selected() and secondTab.selected(), "other tab selects")
		assert(
			first:GetAttribute("Selected") == false and second:GetAttribute("Selected") == true,
			"selection styles react"
		)
		disabled(true)
		selected(1)
		second.Activated:Fire()
		assert(calls == 1 and second:GetAttribute("Disabled") == true, "disabled tab blocks selection")
		remove()
		second.Activated:Fire()
		assert(calls == 1, "unmounted tab disconnects")
		h.stop()
	end,
}
