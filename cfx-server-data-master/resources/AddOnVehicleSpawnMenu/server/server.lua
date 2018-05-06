local CurrentVersion = '2.2.1'

--Update Check

PerformHttpRequest('https://raw.githubusercontent.com/Flatracer/AddOnVehicleSpawnMenu_Resources/master/VERSION', function(Error, NewestVersion, Header)
	PerformHttpRequest('https://raw.githubusercontent.com/Flatracer/AddOnVehicleSpawnMenu_Resources/master/CHANGES', function(Error, Changes, Header)
		print('\n')
		print('####################################################################')
		print('##################### AddOn Vehicle Spawn Menu #####################')
		print('####################################################################')
		print('#####                  Current Version: ' .. CurrentVersion .. '                  #####')
		print('#####                   Newest Version: ' .. NewestVersion .. '                  #####')
		print('####################################################################')
		if CurrentVersion ~= NewestVersion then
			print('##### Outdated, please check the Topic for the newest Version! #####')
			print('####################################################################')
			print('CHANGES: ' .. Changes)
		else
			print('#####                        Up to date!                       #####')
			print('####################################################################')
		end
		print('\n')
	end)
end)

--Add-On Vehicles

RegisterServerEvent('AOVSM:GetVehicles') --Just Don't Edit!
AddEventHandler('AOVSM:GetVehicles', function() --Gets the Add-On Vehicles
	local fileContent = LoadResourceFile(GetCurrentResourceName(), 'Add-On Vehicles.txt')
	if fileContent ~= nil and fileContent ~= '' then
		TriggerClientEvent('AOVSM:GotVehicles', source, fileContent)
	end
end)

--Admin Check

RegisterServerEvent('AOVSM:ID') --Just Don't Edit!
AddEventHandler('AOVSM:ID', function()
	local IDs = GetPlayerIdentifiers(source)
	local Admins = LoadResourceFile(GetCurrentResourceName(), 'Admins.txt')
	local AdminsSplitted = stringsplit(Admins, '\n')
	for k, AdminID in pairs(AdminsSplitted) do
		local AdminID = AdminID:gsub(' ', '')
		local SingleAdminsSplitted = stringsplit(AdminID, ',')
		for _, ID in pairs(IDs) do
			if ID:lower() == SingleAdminsSplitted[1]:lower() or ID:lower() == SingleAdminsSplitted[2]:lower() or ID:lower() == SingleAdminsSplitted[3]:lower() then
				TriggerClientEvent('AOVSM:AdminActivation', source, true); return
			end
		end
	end
end)

AddEventHandler('es:playerLoaded', function(Source, user) --Checks if Player is a ESMode Admin
	if user.getGroup() == 'admin' or user.getGroup() == 'superadmin' then
		TriggerClientEvent('AOVSM:AdminActivation', Source)
	end
end)

function stringsplit(input, seperator)
	if seperator == nil then
		seperator = '%s'
	end
	
	local t={} ; i=1
	
	for str in string.gmatch(input, '([^'..seperator..']+)') do
		t[i] = str
		i = i + 1
	end
	
	return t
end

