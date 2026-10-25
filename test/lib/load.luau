local runtime = require("@tooling/runtime")
return function(options: runtime.Options?): (...string) -> any
	return runtime("out", options)
end
