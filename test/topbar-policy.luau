local M = require("./lib/load")()("topbar-policy")
local function candidate(object: string, x: number, available: boolean?)
	return { object = object, x = x, available = available ~= false }
end
return {
	["top bar focus picks the leftmost available icon"] = function()
		local candidates = { candidate("settings", 200), candidate("hidden", 0, false), candidate("daily", 100) }
		assert(M.pickTopbarIcon(candidates) == "daily", "leftmost available icon wins")
		assert(M.pickTopbarIcon({ candidate("hidden", 0, false) }) == nil, "no available icon picks nothing")
		assert(M.pickTopbarIcon({}) == nil, "an empty top bar picks nothing")
	end,
	["top bar focus returns to the remembered icon while it stays available"] = function()
		local candidates = { candidate("daily", 100), candidate("settings", 200) }
		assert(M.pickTopbarIcon(candidates, "settings") == "settings", "remembered icon wins over order")
		candidates[2] = candidate("settings", 200, false)
		assert(M.pickTopbarIcon(candidates, "settings") == "daily", "an unavailable remembered icon falls back")
		assert(M.pickTopbarIcon(candidates, "removed") == "daily", "a removed remembered icon falls back")
	end,
}
