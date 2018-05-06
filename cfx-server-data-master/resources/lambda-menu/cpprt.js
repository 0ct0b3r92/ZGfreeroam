'use strict';

window.Module = {
	printErr: function(a)
	{
		print(a);
	},

	print: function(a)
	{
		print(a)
	},

	ENVIRONMENT: 'SHELL',

	emterpreterFile: readbuffer('data.binary')
};