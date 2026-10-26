local M = require("./lib/load")()("slider-state")
return {
	["slider snaps from min clamps bounds and reaches a partial final step"] = function()
		local range = { min = 2, max = 9, step = 2 }
		M.validateRange(range)
		assert(M.snapValue(-5, range) == 2, "clamps minimum")
		assert(M.snapValue(5, range) == 6, "snaps relative to min")
		assert(M.snapValue(20, range) == 9, "clamps maximum even off grid")
		assert(M.snapValue(8.9, range) == 8, "interior snaps to a step")
		assert(M.snapValue(7, { min = 4, max = 4, step = 1 }) == 4, "fixed range")
	end,
	["slider rejects invalid ranges steps and values"] = function()
		for _, range in
			{
				{ min = 5, max = 1, step = 1 },
				{ min = 0, max = math.huge, step = 1 },
				{ min = 0, max = 1, step = 0 },
				{ min = 0 / 0, max = 1, step = 1 },
				{ min = 0, max = 1, step = -1 },
			}
		do
			assert(not pcall(M.validateRange, range), "invalid configuration rejected")
		end
		assert(not pcall(M.snapValue, 0 / 0, { min = 0, max = 1, step = 1 }), "NaN rejected")
	end,
	["slider commits the last changed value once per hold"] = function()
		local hold = M.SliderCommit.new()
		hold:begin()
		assert(hold:release() == nil, "unchanged hold does not commit")
		hold:begin()
		hold:change(4)
		hold:change(6)
		assert(hold:release() == 6, "last changed value commits")
		assert(hold:release() == nil, "duplicate release does not commit")
		hold:change(8)
		hold:begin()
		assert(hold:release() == nil, "new hold starts clean")
	end,
}
