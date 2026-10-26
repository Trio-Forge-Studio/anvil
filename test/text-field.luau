local harness = require("./lib/harness")
return {
	["text field binds controlled text limits changes and commits completion on Enter"] = function()
		local h = harness()
		local owner = h.root(10)
		local text = h.charm.atom("he")
		local completion = h.charm.atom("hello")
		local disabled = h.charm.atom(false)
		local invalid = h.charm.atom(false)
		local changes, submissions, commits, events = {}, {}, {}, {}
		local field = h.instance("TextButton", owner)
		local box = h.instance("TextBox", owner)
		local binding = h.mount(owner, function()
			local binding = h.require("use-text-field").useTextField({
				text = text,
				completion = completion,
				disabled = disabled,
				invalid = invalid,
				maxLength = 4,
				selectFirst = true,
				onChange = function(value)
					table.insert(changes, value)
					table.insert(events, "change")
					text(value)
				end,
				onSubmit = function(value)
					table.insert(submissions, value)
					table.insert(events, "submit")
				end,
				onCommit = function(value)
					table.insert(commits, value)
					table.insert(events, "commit")
				end,
			})
			binding.field(field)
			binding.box(box)
			return binding
		end)
		h.flush()
		local globalEditing = h.require("modal").useTextEditing()
		assert(h.gui.SelectedObject == field and not box.Selectable, "only field receives gamepad selection")
		assert(not box.ClearTextOnFocus and box.TextEditable and box.Text == "he", "box properties bind")
		assert(
			field:GetAttribute("Editing") == false and field:GetAttribute("Invalid") == false,
			"field attributes start false"
		)
		assert(binding.completionText() == "hello", "completion is readable")
		field.Activated:Fire()
		assert(
			binding.editing() and globalEditing() and field:GetAttribute("Editing") == true,
			"focus uses shared editing runtime"
		)
		assert(not h.contexts.Menu, "text editing releases menu input")
		box.Text = "hello!"
		assert(box.Text == "hell" and text() == "hell" and #changes == 1, "clamp reports one change")
		box.Text = "hellx"
		assert(#changes == 1 and box.Text == "hell", "clamping to unchanged value does not notify")
		text("ha")
		assert(box.Text == "ha" and #changes == 1, "controlled updates do not echo")
		assert(binding.completionText() == "hallo", "completion keeps typed prefix")
		box:ReleaseFocus(true)
		h.flush()
		assert(text() == "hell" and box.Text == "hell" and changes[2] == "hell", "Enter accepts limited completion")
		assert(submissions[1] == "hell" and commits[1] == "hell", "Enter submits then commits")
		assert(events[2] == "change" and events[3] == "submit" and events[4] == "commit", "completion callback order")
		assert(not binding.editing() and not globalEditing() and h.contexts.Menu, "blur restores menu input")
		completion(nil)
		assert(binding.completionText() == nil, "completion can disappear")
		field.Activated:Fire()
		box:ReleaseFocus(false)
		h.flush()
		assert(#submissions == 1 and #commits == 2 and commits[2] == "hell", "ordinary blur always commits")
		invalid(true)
		disabled(true)
		assert(
			field:GetAttribute("Invalid") == true and field:GetAttribute("Disabled") == true,
			"validation and disabled styling react"
		)
		assert(not box.TextEditable, "disabled text is not editable")
		field.Activated:Fire()
		assert(not box:IsFocused(), "disabled field cannot focus")
		box.Text = "oops"
		assert(box.Text == "hell" and #changes == 2, "disabled edits restore controlled text")
		h.stop()
	end,
	["text field defers autofocus and cancels it after disposal or disabling"] = function()
		local h = harness()
		local disabled = h.charm.atom(false)
		local box = h.instance("TextBox", "Base")
		local _, dispose = h.mount("Base", function()
			local binding = h.require("use-text-field")
				.useTextField({ text = "", onChange = function() end, autoFocus = true })
			binding.box(box)
		end)
		assert(not box:IsFocused(), "autofocus is deferred")
		dispose()
		h.flush()
		assert(not box:IsFocused(), "disposed field never captures focus")
		local _, remove = h.mount("Base", function()
			local binding = h.require("use-text-field").useTextField({
				text = "",
				onChange = function() end,
				autoFocus = true,
				disabled = disabled,
			})
			binding.box(box)
		end)
		disabled(true)
		h.flush()
		assert(not box:IsFocused(), "disabled field never captures deferred focus")
		remove()
		disabled(false)
		local _, release = h.mount("Base", function()
			local binding = h.require("use-text-field")
				.useTextField({ text = "", onChange = function() end, autoFocus = true })
			binding.box(box)
		end)
		h.flush()
		assert(box:IsFocused(), "live enabled field captures focus")
		release()
		h.flush()
		assert(not box:IsFocused() and not h.require("modal").useTextEditing()(), "disposal releases shared focus")
		h.stop()
	end,
}
