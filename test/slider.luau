local harness = require("./lib/harness")
return {
	["slider with equal bounds has no steps and a finite fraction"] = function()
		local h = harness()
		local calls = 0
		local minus = h.instance("TextButton", "Base")
		local plus = h.instance("TextButton", "Base")
		local slider = h.mount("Base", function()
			local binding = h.require("use-slider").useSlider({
				value = 20,
				min = 4,
				max = 4,
				onChange = function()
					calls += 1
				end,
				onCommit = function()
					calls += 1
				end,
			})
			binding.decrement.action(minus)
			binding.increment.action(plus)
			return binding
		end)
		assert(
			slider.value() == 4 and slider.fraction() == 0 and slider.atMin() and slider.atMax(),
			"fixed range is normalized"
		)
		assert(
			minus:GetAttribute("Disabled") == true and plus:GetAttribute("Disabled") == true,
			"both endpoints disabled initially"
		)
		slider.set(9)
		assert(calls == 0, "fixed range never changes or commits")
		h.stop()
	end,
	["slider repeats commits on release at a bound and guards disabled controls"] = function()
		local h = harness()
		local owner = h.root(10)
		local value = h.charm.atom(1)
		local disabled = h.charm.atom(false)
		local changes, commits = {}, {}
		local minus = h.instance("TextButton", owner)
		local plus = h.instance("TextButton", owner)
		local segment = h.instance("TextButton", owner)
		local slider = h.mount(owner, function()
			local binding = h.require("use-slider").useSlider({
				value = value,
				max = 3,
				disabled = disabled,
				selectFirst = true,
				onChange = function(next)
					table.insert(changes, next)
					value(next)
				end,
				onCommit = function(next)
					table.insert(commits, next)
				end,
			})
			binding.decrement.action(minus)
			binding.increment.action(plus)
			binding.segment(2).action(segment)
			return binding
		end)
		h.flush()
		assert(h.gui.SelectedObject == minus, "decrement receives initial selection")
		assert(slider.fraction() == 1 / 3 and segment:GetAttribute("Selected") == false, "initial fraction and segment")
		h.select(plus)
		local input = h.begin(h.enum.KeyCode.ButtonA)
		assert(value() == 2 and #commits == 0, "hold changes immediately without commit")
		h.tick(0.4)
		assert(value() == 3 and slider.atMax() and plus:GetAttribute("Disabled") == true, "repeat reaches max")
		assert(#commits == 0, "bound cancellation must wait for release")
		assert(segment:GetAttribute("Selected") == true, "segment reacts to stepped value")
		h.tick(1)
		assert(#changes == 2, "disabled endpoint cannot repeat")
		h.finish(input)
		assert(#commits == 1 and commits[1] == 3, "one commit on physical release")
		h.finish(input)
		assert(#commits == 1, "duplicate release is harmless")
		input = h.begin(h.enum.KeyCode.ButtonA)
		h.finish(input)
		assert(#changes == 2 and #commits == 1, "unchanged disabled hold does not commit")
		slider.set(-9)
		assert(slider.atMin() and minus:GetAttribute("Disabled") == true and commits[2] == 0, "set clamps and commits")
		slider.set(0)
		assert(#commits == 2, "unchanged set does not commit")
		segment.Activated:Fire()
		assert(value() == 2 and commits[3] == 2, "segment changes and commits immediately")
		disabled(true)
		assert(plus:GetAttribute("Disabled") == true and segment:GetAttribute("Disabled") == true, "global disable")
		slider.set(1)
		segment.Activated:Fire()
		assert(value() == 2 and #commits == 3, "disabled set and segment cannot change")
		h.stop()
	end,
	["slider pointer hold snaps fractional ranges and commits only changed holds"] = function()
		local h = harness()
		local current = h.charm.atom(2)
		local commits = {}
		local plus = h.instance("TextButton", "Base")
		local minus = h.instance("TextButton", "Base")
		local slider = h.mount("Base", function()
			local binding = h.require("use-slider").useSlider({
				value = current,
				min = 2,
				max = 3,
				step = 0.25,
				onChange = current,
				onCommit = function(value)
					table.insert(commits, value)
				end,
			})
			binding.increment.action(plus)
			binding.decrement.action(minus)
			return binding
		end)
		slider.set(2.36)
		assert(current() == 2.25 and slider.fraction() == 0.25 and commits[1] == 2.25, "fractional step snaps")
		local pointer = { UserInputType = h.enum.UserInputType.MouseButton1 }
		plus.InputBegan:Fire(pointer)
		assert(current() == 2.5 and #commits == 1, "pointer hold changes before settling")
		h.input.InputEnded:Fire(pointer)
		assert(commits[2] == 2.5, "pointer release commits")
		plus.Activated:Fire()
		assert(current() == 2.5 and #commits == 2, "activated after timed press cannot step twice")
		h.stop()
	end,
}
