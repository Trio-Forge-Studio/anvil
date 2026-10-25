local M = require("./lib/load")()("selection-policy")
local function context(current: string?, close: string?)
	return {
		current = current,
		close = close,
		canSelect = true,
		alive = function(value)
			return value ~= "dead"
		end,
	}
end
return {
	["selection remembers owned elements and falls through marks close then root"] = function()
		local s = M.emptySelection()
		assert(
			M.decide(s, { kind = "Shown" }, context()).target == "Root",
			'Expected M.decide(s, { kind = "Shown" }, context()).target == "Root"'
		)
		assert(
			M.decide(s, { kind = "Shown" }, context(nil, "close")).target == "close",
			'Expected M.decide(s, { kind = "Shown" }, context(nil, "close")).target == "close"'
		)
		s = M.decide(s, { kind = "Marked", object = "claim" }, context()).selection
		assert(
			M.decide(s, { kind = "Shown" }, context()).target == "claim",
			'Expected M.decide(s, { kind = "Shown" }, context()).target == "claim"'
		)
		s = M.decide(s, { kind = "Selected", object = "other" }, context()).selection
		assert(
			M.decide(s, { kind = "Shown" }, context()).target == "other",
			'Expected M.decide(s, { kind = "Shown" }, context()).target == "other"'
		)
		s = M.decide(s, { kind = "Unmarked", object = "claim" }, context()).selection
		assert(
			M.decide(s, { kind = "Lost", removed = true }, context(nil, "close")).target == "close",
			'Expected M.decide(s, { kind = "Lost", removed = true }, context(nil, "close")).target == "close"'
		)
	end,
	["late marks replace only their own selection and preserve explicit deselection"] = function()
		local s = M.emptySelection()
		s = M.decide(s, { kind = "Marked", object = "old" }, context()).selection
		assert(
			M.decide(s, { kind = "Marked", object = "new", replaces = "old" }, context("old")).target == "new",
			'Expected M.decide(s, { kind = "Marked", object = "new", replaces = "old" }, context("old")).target == "new"'
		)
		assert(
			M.decide(s, { kind = "Marked", object = "new", replaces = "old" }, context("other")).target == nil,
			'Expected M.decide(s, { kind = "Marked", object = "new", replaces = "old" }, context("other")).target == nil'
		)
		s = M.decide(s, { kind = "Lost", removed = false }, context()).selection
		assert(
			s.paused and M.decide(s, { kind = "Shown" }, context()).target == nil,
			'Expected s.paused and M.decide(s, { kind = "Shown" }, context()).target == nil'
		)
		assert(
			M.decide(s, { kind = "Marked", object = "late" }, context()).target == nil,
			'Expected M.decide(s, { kind = "Marked", object = "late" }, context()).target == nil'
		)
		s = M.decide(s, { kind = "Selected", object = "tab" }, context()).selection
		assert(not s.paused, "Expected not s.paused")
	end,
	["covered marks accumulate without stealing restoration"] = function()
		local s = M.emptySelection()
		local c = context()
		c.canSelect = false
		local d = M.decide(s, { kind = "Marked", object = "late" }, c)
		assert(d.target == nil and #d.selection.marked == 1, "Expected d.target == nil and #d.selection.marked == 1")
		d = M.decide(d.selection, { kind = "Selected", object = "tab" }, c)
		assert(
			M.decide(d.selection, { kind = "Shown" }, context()).target == "tab",
			'Expected M.decide(d.selection, { kind = "Shown" }, context()).target == "tab"'
		)
	end,
}
