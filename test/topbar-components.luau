local harness = require("./lib/harness")
local roblox: any = require("@lune/roblox")
local function child(object, ...: string)
	for _, name in { ... } do
		object = object:FindFirstChild(name)
		assert(object, "found " .. name)
	end
	return object
end
local function mount(h, props)
	local Topbar = h.require("topbar")
	return h.mount("Base", function()
		local icons = {}
		for index, given in props.icons do
			icons[index] = Topbar.Topbar.Icon(given)
		end
		return Topbar.Topbar.Root({ side = props.side, displayOrder = 12, children = icons })
	end)
end
return {
	["default top bar fills the top bar inset above modals and follows inset changes"] = function()
		local h = harness()
		local gui = mount(h, { side = "Right", icons = {} })
		assert(gui.Name == "TopbarRight" and gui.DisplayOrder == 12, "the game chooses the layer")
		assert(gui.ResetOnSpawn == false, "the top bar survives respawn")
		assert(gui.ScreenInsets == roblox.Enum.ScreenInsets.TopbarSafeInsets, "the gui covers the top bar inset")
		local icons = child(gui, "Icons")
		assert(icons.Size == roblox.UDim2.new(1, 0, 1, -2), "icons sit 2 px above the inset bottom")
		assert(child(icons, "UIListLayout").Padding == roblox.UDim.new(0, 8), "icons keep an 8 px gap")
		assert(child(icons, "UIPadding").PaddingRight == roblox.UDim.new(0, 12), "the right edge keeps 12 px")
		h.gui.TopbarInset = { Height = 0 }
		assert(icons.Position == roblox.UDim2.fromOffset(0, 15), "a hidden top bar moves the row down")
		assert(icons.Size == roblox.UDim2.new(1, 0, 1, 50), "a hidden top bar keeps a 50 px row")
		h.stop()
	end,
	["default top bar icon orders draws state notice and caption"] = function()
		local h = harness()
		h.device("Keyboard")
		local selected = h.vide.source(false)
		local presses = {}
		local gui = mount(h, {
			side = "Left",
			icons = {
				{
					name = "Settings",
					image = "rbxassetid://1",
					caption = "Settings",
					order = 2,
					selected = selected,
					notice = 120,
					onSelectedChange = function(next)
						table.insert(presses, next)
					end,
				},
				{
					name = "Daily",
					image = "rbxassetid://2",
					order = 1,
					selected = false,
					notice = true,
				},
			},
		})
		local icons = child(gui, "Icons")
		local settings, daily = child(icons, "Settings"), child(icons, "Daily")
		assert(daily.LayoutOrder == 1 and settings.LayoutOrder == 2, "order becomes LayoutOrder")
		assert(child(icons, "UIPadding").PaddingLeft == roblox.UDim.new(0, 8), "the left edge uses the gap")
		local button = child(settings, "ClickRegion")
		assert(math.abs(button.BackgroundTransparency - 0.08) < 1e-6, "the default transparency matches TopbarPlus")
		h.gui.PreferredTransparency = 0.5
		assert(math.abs(button.BackgroundTransparency - 0.04) < 1e-6, "PreferredTransparency scales the background")
		assert(child(settings, "Notice", "TextLabel").Text == "99+", "large counts cap at 99+")
		assert(child(daily, "Notice", "TextLabel").Text == "1", "a boolean notice reads 1")
		assert(daily:FindFirstChild("Caption") == nil, "no caption draws nothing")
		local caption = child(settings, "Caption")
		button.MouseEnter:Fire()
		assert(child(button, "IconSpot", "IconOverlay").Visible, "hover shows the overlay")
		h.tick(0.5)
		assert(caption.Visible, "the caption shows after the hover delay")
		button.Activated:Fire()
		assert(
			presses[1] == true and child(button, "IconSpot").BackgroundTransparency == 1,
			"a press leaves selection to the game"
		)
		selected(true)
		local spot = child(button, "IconSpot")
		assert(spot.BackgroundTransparency == 0.7 and child(spot, "UIGradient").Enabled, "selection lights the spot")
		h.stop()
	end,
}
