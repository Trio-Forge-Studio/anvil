local M = require("./lib/load")()("alert-dialog-state")
return {
	["dialog policy selects cancel only for a destructive dialog with a cancel action"] = function()
		for _, destructive in { false, true } do
			for _, cancellable in { false, true } do
				local confirms, cancels, closes = 0, 0, 0
				local policy = M.alertDialogPolicy({
					destructive = destructive,
					onConfirm = function()
						confirms += 1
					end,
					onCancel = if cancellable
						then function()
							cancels += 1
						end
						else nil,
					onClose = function()
						closes += 1
					end,
				})
				assert(policy.dialog.confirm.selectFirst == not (destructive and cancellable), "safe initial choice")
				assert((policy.dialog.cancel ~= nil) == cancellable, "cancel exists only when supplied")
				if policy.dialog.cancel then
					assert(policy.dialog.cancel.selectFirst == destructive, "destructive cancel marked first")
					policy.dialog.cancel.onPress()
					assert(cancels == 1, "cancel invokes callback")
				end
				policy.dialog.confirm.onPress()
				assert(confirms == 1, "confirm invokes callback")
				policy.onClose()
				assert(
					if cancellable then cancels == 2 and closes == 0 else closes == 1,
					"close maps to cancel before fallback"
				)
			end
		end
		assert(M.alertDialogPolicy({ onConfirm = function() end }).onClose == nil, "close can be absent")
	end,
}
