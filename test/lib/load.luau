local runtime = require("./runtime")
return function(options: runtime.Options?): (...string) -> any
	return runtime("out", options)
end
