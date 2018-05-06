-- GUI <<

RegisterNetEvent('AOVSM:Title')
AddEventHandler('AOVSM:Title', function(title)
	Title(title)
end)

RegisterNetEvent('AOVSM:Option')
AddEventHandler('AOVSM:Option', function(option, cb)
	cb(Option(option))
end)

RegisterNetEvent('AOVSM:Bool')
AddEventHandler('AOVSM:Bool', function(option, bool, cb)
	Bool(option, bool, function(data)
		cb(data)
	end)
end)

RegisterNetEvent('AOVSM:Update')
AddEventHandler('AOVSM:Update', function()
	updateSelection()
end)

local maxVisOptions = 22
local menuX = 0.85

local titleText = {255, 255, 255, 255}
local titleRect = {0, 51, 0, 255}
local optionText = {255, 255, 255, 255}
local optionRect = {40, 40, 40, 190}
local scroller = {127, 140, 140, 240}
local titleTextSize = {0.8, 0.8}
local optionTextSize = {0.5, 0.5}

local blockinput = false
local selectPressed = false
local leftPressed = false
local rightPressed = false
local optionCount = 0
local currentOption = 1

Citizen.CreateThread(function()
	local fontId
	RegisterFontFile('ArialNarrow')
	fontId = RegisterFontId('Arial Narrow')
	while true do
		Citizen.Wait(0)
		if not HasThisAdditionalTextLoaded('global', 100) then
			ClearAdditionalText(100, true)
			RequestAdditionalText('global', 100)
			while not HasThisAdditionalTextLoaded('global', 100) do
				Citizen.Wait(0)
			end
		end
		titleText[5] = fontId
		optionText[5] = fontId
		titleTextSize[1] = 0.65
		titleTextSize[2] = 0.65
		optionTextSize[1] = 0.375
		optionTextSize[2] = 0.375
	end
end)

function Text(text, color, position, size, center)
	SetTextCentre(center)
	SetTextColour(color[1], color[2], color[3], color[4])
	SetTextFont(color[5])
	SetTextScale(size[1], size[2])
	Citizen.InvokeNative(0x61BB1D9B3A95D802, 7)
	SetTextEntry('STRING')
	AddTextComponentString(text)
	DrawText(position[1], position[2])
end

function Rect(color, position, size)
	Citizen.InvokeNative(0x61BB1D9B3A95D802, 6)
	DrawRect(position[1], position[2], size[1], size[2], color[1], color[2], color[3], color[4])
end

function Title(title)
	Text(title, titleText, {menuX, 0.095}, titleTextSize, true)
	Rect(titleRect, {menuX, 0.1175}, {0.23, 0.085})
end

function Option(option)
	optionCount = optionCount + 1

	local thisOption = nil
	if(currentOption == optionCount) then
		FloatIntArray = false
		thisOption = true
	else
		thisOption = false
	end

	if(currentOption <= maxVisOptions and optionCount <= maxVisOptions) then
		Text(option, optionText, {menuX - 0.1, optionCount * 0.035 + 0.125}, optionTextSize, false)
		Rect(optionRect, { menuX, optionCount * 0.035 + 0.1415 }, { 0.23, 0.035 })
		if(thisOption) then
			Rect(scroller, { menuX, optionCount * 0.035 + 0.1415 }, { 0.23, 0.035 })
		end
	elseif (optionCount > currentOption - maxVisOptions and optionCount <= currentOption) then
		Text(option, optionText, { menuX - 0.1, optionCount - (currentOption - maxVisOptions) * 0.035 + 0.125 }, optionTextSize, false);
		Rect(optionRect, { menuX, optionCount - (currentOption - maxVisOptions) * 0.035+0.1415 }, { 0.23, 0.035 });
		if(thisOption) then
			Rect(scroller, { menuX, optionCount - (currentOption - maxVisOptions) * 0.035 + 0.1415 }, { 0.23, 0.035 })
		end
	end

	if (optionCount == currentOption and selectPressed) then
		return true
	end

	return false
end

function Bool(option, bool, cb)
	Option(option)

	if(currentOption <= maxVisOptions and optionCount <= maxVisOptions) then
		if (bool) then
			Text('~g~' .. GetLabelText("FMMC_SEL_ON"), optionText, { menuX + 0.078, optionCount * 0.035 + 0.125 }, optionTextSize, true)
		else
			Text('~r~' .. GetLabelText("FMMC_SEL_OFF"), optionText, { menuX + 0.078, optionCount * 0.035 + 0.125 }, optionTextSize, true)
		end
	elseif(optionCount > currentOption - maxVisOptions and optionCount <= currentOption) then
		if (bool) then
			Text('~g~' .. GetLabelText("FMMC_SEL_ON"), optionText, { menuX + 0.078, optionCount - (currentOption - maxVisOptions) * 0.035 + 0.125 }, optionTextSize, true)
		else
			Text('~r~' .. GetLabelText("FMMC_SEL_OFF"), optionText, { menuX + 0.078, optionCount - (currentOption - maxVisOptions) * 0.035 + 0.125 }, optionTextSize, true)
		end
	end

	if optionCount == currentOption and selectPressed then
		cb(not bool)
		return true
	end

	return false
end

function updateSelection()
	selectPressed = false;
	leftPressed = false;
	rightPressed = false;

	if GetIsControlJustPressed(173) and not blockinput then --Down
		if(currentOption < optionCount) then
			currentOption = currentOption + 1
		else
			currentOption = 1
		end
	elseif GetIsControlJustPressed(172) and not blockinput then --Up
		if(currentOption > 1) then
			currentOption = currentOption - 1
		else
			currentOption = optionCount
		end
	elseif GetIsControlJustPressed(174) and not blockinput then --Left
		leftPressed = true
	elseif GetIsControlJustPressed(175) and not blockinput then --Right
		rightPressed = true
	elseif GetIsControlJustPressed(176) and not blockinput then --Select
		selectPressed = true
	elseif (currentOption > optionCount) then
		currentOption = optionCount
	end
	optionCount = 0
end

-- >> GUI

-- Actual Menu <<

local IsAdmin, MaximumAddOns, InstructionsDraw, SpawnModel
local AddOnVehiclesMenu = false; AddOnVehiclesSpawn = false; AddOnVehiclesSpawnSettings = false
local AddOnVehiclesTable = {}; AddOnVehiclesSubTable = {}; lastSelection = {}; lastSite = {}; CurrentCategory = {}

AddEventHandler('playerSpawned', function(spawn) --Checks for Add-On Vehicles at Spawn
	IsAdmin = nil
	if OnlyForAdmins then
		TriggerServerEvent('AOVSM:ID')
		while IsAdmin == nil do
			Citizen.Wait(0)
		end
		if IsAdmin then
			TriggerServerEvent('AOVSM:GetVehicles')
		end
	else
		TriggerServerEvent('AOVSM:GetVehicles')
	end
end)

RegisterNetEvent('AOVSM:AdminActivation')
AddEventHandler('AOVSM:AdminActivation', function(state) --Just Don't Edit!
	IsAdmin = state
end)

Citizen.CreateThread(function() --Pages
	while true do
		Citizen.Wait(0)
		
		if AddOnVehiclesMenu then
			TriggerEvent('AOVSM:Title', '~y~Custom Vehicle Menu')
			
			if UseCategorization then
				CurrentCategory = {}
			
				if not IsDisabledControlPressed(1, 173) and not IsDisabledControlPressed(1, 172) then
					currentOption = lastSelection[1]
				else
					lastSelection[1] = currentOption
				end
			
				for i = 0, 21 do
					if DoesClassExist(i) then
						TriggerEvent('AOVSM:Option', '~y~>> ~s~' .. GetLabelText('VEH_CLASS_' .. i), function(cb)
							if (cb) then
								CurrentCategory[i + 1] = true
								currentOption = lastSelection[i + 2]
								GetVehiclesOfClass(i)
								AddOnVehiclesMenu = false
								AddOnVehiclesSpawn = true
							end
						end)
					end
				end
			else
				if lastSite[1] == nil then
					lastSite[1] = 1
				end
				local add = (maxVisOptions - 1) * lastSite[1]
				
				if IsDisabledControlJustReleased(1, 174)then
					if lastSite[1] == 1 then
						local lastPage = math.ceil(MaximumAddOns / (maxVisOptions - 1))
						
						while AddOnVehiclesTable[lastPage * (maxVisOptions - 1) - 19] == nil do
							Citizen.Wait(0)
							lastPage = lastPage - 1
						end
						lastSite[1] = lastPage
					else
						lastSite[1] = lastSite[1] - 1
					end
				elseif IsDisabledControlJustReleased(1, 175)then
					if AddOnVehiclesTable[add + 1] then
						lastSite[1] = lastSite[1] + 1
					else
						lastSite[1] = 1
					end
				end
			
				for i = add  - 19, add do
					if AddOnVehiclesTable[i] ~= nil then
						TriggerEvent('AOVSM:Option', AddOnVehiclesTable[i][2], function(cb)
							if (cb) then
								SpawnModel = GetHashKey(AddOnVehiclesTable[i][1])
							end
						end)
					end
				end

				if lastSite[1] ~= 1 or (lastSite[1] == 1 and AddOnVehiclesTable[add + 1]) then
					TriggerEvent('AOVSM:Option', '~r~' .. GetLabelText('HUD_PAGE'):gsub('~1~', math.ceil(lastSite[1]), 1):gsub('~1~', math.ceil(#AddOnVehiclesTable / (maxVisOptions - 1))), function(cb)
						if (cb) then
							SetNotificationTextEntry('STRING')
							AddTextComponentString('~r~' .. GetLabelText('HUD_PAGE'):gsub('~1~', math.ceil(lastSite[1]), 1):gsub('~1~', math.ceil(#AddOnVehiclesTable / (maxVisOptions - 1))))
							DrawNotification(false, false)
						end
					end)
				end
			end

			TriggerEvent('AOVSM:Update')
		
		elseif AddOnVehiclesSpawn then
		
			local CurCat
		
			for i = 1, 21 do
				if CurrentCategory[i] == true then
					CurCat = i
					break
				end
			end
			
			if not IsDisabledControlPressed(1, 173) and not IsDisabledControlPressed(1, 172) then
				currentOption = lastSelection[CurCat + 2]
			else
				lastSelection[CurCat + 2] = currentOption
			end
		
			local add = (maxVisOptions - 1) * lastSite[CurCat + 1]
			
			if IsDisabledControlJustReleased(1, 174)then
				if lastSite[CurCat + 1] == 1 then
					local lastPage = math.ceil(MaximumAddOns / (maxVisOptions - 1))
					
					while AddOnVehiclesSubTable[lastPage * (maxVisOptions - 1) - 19] == nil do
						Citizen.Wait(0)
						lastPage = lastPage - 1
					end
					lastSite[CurCat + 1] = lastPage
				else
					lastSite[CurCat + 1] = lastSite[CurCat + 1] - 1
				end
			elseif IsDisabledControlJustReleased(1, 175)then
				if AddOnVehiclesSubTable[add + 1] then
					lastSite[CurCat + 1] = lastSite[CurCat + 1] + 1
				else
					lastSite[CurCat + 1] = 1
				end
			end
		
			TriggerEvent('AOVSM:Title', '~y~Custom Vehicle Menu')

			for i = add  - (maxVisOptions - 2), add do
				if AddOnVehiclesSubTable[i] ~= nil then
					TriggerEvent('AOVSM:Option', AddOnVehiclesSubTable[i][2], function(cb)
						if (cb) then
							SpawnModel = GetHashKey(AddOnVehiclesSubTable[i][1])
						end
					end)
				end
			end

			if lastSite[CurCat + 1] ~= 1 or (lastSite[CurCat + 1] == 1 and AddOnVehiclesSubTable[add + 1]) then
				TriggerEvent('AOVSM:Option', '~r~' .. GetLabelText('HUD_PAGE'):gsub('~1~', math.ceil(lastSite[CurCat + 1]), 1):gsub('~1~', math.ceil(#AddOnVehiclesSubTable / (maxVisOptions - 1))), function(cb)
					if (cb) then
						SetNotificationTextEntry('STRING')
						AddTextComponentString('~r~' .. GetLabelText('HUD_PAGE'):gsub('~1~', math.ceil(lastSite[CurCat + 1]), 1):gsub('~1~', math.ceil(#AddOnVehiclesSubTable / (maxVisOptions - 1))))
						DrawNotification(false, false)
					end
				end)
			end

			TriggerEvent('AOVSM:Update')
			
		elseif AddOnVehiclesSpawnSettings then
		
			TriggerEvent('AOVSM:Title', '~y~Add-On Vehicles Settings')
			
			TriggerEvent('AOVSM:Bool', 'Despawnable', despawnable, function(cb)
				despawnable = cb
				if not despawnable then
					autodelete = true
				end
			end)

			TriggerEvent('AOVSM:Bool', 'Replace', autodelete, function(cb)
				autodelete = cb
				if not autodelete then
					despawnable = true
				end
			end)

			TriggerEvent('AOVSM:Bool', 'Mark On Map', mapblip, function(cb)
				mapblip = cb
			end)

			TriggerEvent('AOVSM:Bool', 'Categorization', UseCategorization, function(cb)
				UseCategorization = cb
			end)

			TriggerEvent('AOVSM:Update')
		end
	end
end)

Citizen.CreateThread(function() --Vehicle Spawning
	while true do
		Citizen.Wait(0)
		local x, y, z = table.unpack(GetEntityCoords(GetPlayerPed(-1), true))
		if spawnVehicleByName then
			local result = KeyboardInput('Spawn by Name:', '', 25, false)

			if result ~= nil then
				SpawnModel = GetHashKey(string.upper(result))
			else
				drawNotification('~r~Cancelled!')
			end
			spawnVehicleByName = false
		elseif SpawnModel then
			if IsModelValid(SpawnModel) then
				if autodelete then
					if IsPedInAnyVehicle(GetPlayerPed(-1), true) then
						SetEntityAsMissionEntity(Object, 1, 1)
						SetEntityAsMissionEntity(GetVehiclePedIsIn(GetPlayerPed(-1), false), 1, 1)
						DeleteEntity(Object)
						DeleteVehicle(GetVehiclePedIsIn(GetPlayerPed(-1), false))
					end
				end
				blockinput = true
				RequestModel(SpawnModel)
				while not HasModelLoaded(SpawnModel) do
					Citizen.Wait(0)
				end
				local veh = CreateVehicle(SpawnModel, x, y, z + 1, GetEntityHeading(GetPlayerPed(-1)), true, true)
				SetPedIntoVehicle(GetPlayerPed(-1), veh, -1)
				if despawnable then
					SetEntityAsNoLongerNeeded(veh)
				else
					SetVehicleHasBeenOwnedByPlayer(veh, true)
				end
				
				if mapblip then
					local vehBlip = AddBlipForEntity(veh)
					SetBlipColour(vehBlip, 3)
				end
				SetVehicleModKit(veh, 0)
				SetModelAsNoLongerNeeded(SpawnModel)
				blockinput = false
			else
				SetNotificationTextEntry('STRING')
				AddTextComponentString('~r~Invalid Model!')
				DrawNotification(false, false)
			end
			SpawnModel = nil
		end
	end
end)

Citizen.CreateThread(function() --Controls, Disables Controls Used In The Trainer, Draws Instruction Buttons, Disables Menu When In Pausemenu
	local Time
	
	for i = 1, 22 do
		lastSelection[i] = 1
		lastSite[i] = 1
	end

	while true do
		Citizen.Wait(0)
		
		if AddOnVehiclesTable[1] then
			if GetIsControlPressed(SettingsKey) and GetIsControlJustPressed(KBKey) and GetLastInputMethod(2) and SettingsAllowed then
				AddOnVehiclesMenu = false
				AddOnVehiclesSpawn = false
				AddOnVehiclesSpawnSettings = not AddOnVehiclesSpawnSettings
				InstructionsDraw = AddOnVehiclesSpawnSettings
			elseif ((GetIsControlJustPressed(KBKey) and GetLastInputMethod(2)) or ((GetIsControlPressed(GPKey1) and GetIsControlJustPressed(GPKey2)) and not GetLastInputMethod(2))) then
				AddOnVehiclesSpawnSettings = false
				if AddOnVehiclesMenu then
					AddOnVehiclesMenu = false
				elseif AddOnVehiclesSpawn then
					AddOnVehiclesSpawn = false
				else
					AddOnVehiclesMenu = true
					InstructionsDraw = true
				end
			elseif GetIsControlJustPressed(177) then
				if AddOnVehiclesSpawn then
					AddOnVehiclesSpawn = false
					AddOnVehiclesMenu = true
				else
					AddOnVehiclesMenu = false
					AddOnVehiclesSpawnSettings = false
				end
			end
		end
		
		if AddOnVehiclesMenu or AddOnVehiclesSpawn or AddOnVehiclesSpawnSettings then
			DisableControlAction(1, 20, true)
			DisableControlAction(1, 21, true)
			DisableControlAction(1, 45, true)
			DisableControlAction(1, 73, true)
			DisableControlAction(1, 74, true)
			DisableControlAction(1, 76, true)
			DisableControlAction(1, 80, true)
			DisableControlAction(1, 85, true)
			DisableControlAction(1, 99, true)
			DisableControlAction(1, 114, true)
			DisableControlAction(1, 140, true)
			DisableControlAction(1, 172, true)
			DisableControlAction(1, 173, true)
			DisableControlAction(1, 174, true)
			DisableControlAction(1, 175, true)
			DisableControlAction(1, 176, true)
			DisableControlAction(1, 177, true)
			DisableControlAction(1, 178, true)
			DisableControlAction(1, 179, true)
			
			if InstructionsDraw and UpdateOnscreenKeyboard() ~= 0 and not IsEntityDead(GetPlayerPed(-1)) then --Draws Instructions Messages When Trainer Is On
				local Browse, Select, Back
				if GetLastInputMethod(2) then
					Browse = 47
				else
					Browse = 9
				end
				Select = GetControlInstructionalButton(1, 176, true):gsub("b_", "")
				Back = GetControlInstructionalButton(1, 177, true):gsub("b_", "")
		
				local ScaleformMovie = RequestScaleformMovie("instructional_buttons")
				DrawScaleformMovieFullscreen(ScaleformMovie, 255, 255, 255, 0)
				PushScaleformMovieFunction(ScaleformMovie, "CLEAR_ALL")
				PopScaleformMovieFunctionVoid()
				PushScaleformMovieFunction(ScaleformMovie, "SET_CLEAR_SPACE")
				PushScaleformMovieFunctionParameterInt(200)
				PopScaleformMovieFunctionVoid()
				
				PushScaleformMovieFunction(ScaleformMovie, "SET_DATA_SLOT")
				PushScaleformMovieFunctionParameterInt(0)
				PushScaleformMovieFunctionParameterInt(Browse)
				BeginTextCommandScaleformString("STRING")
				AddTextComponentScaleform(GetLabelText("IB_NAVIGATE"))
				EndTextCommandScaleformString()	
				PopScaleformMovieFunctionVoid()

				PushScaleformMovieFunction(ScaleformMovie, "SET_DATA_SLOT")
				PushScaleformMovieFunctionParameterInt(1)
				PushScaleformMovieFunctionParameterInt(tonumber(Select))
				BeginTextCommandScaleformString("STRING")
				AddTextComponentScaleform(GetLabelText("IB_SELECT"))
				EndTextCommandScaleformString()	
				PopScaleformMovieFunctionVoid()

				PushScaleformMovieFunction(ScaleformMovie, "SET_DATA_SLOT")
				PushScaleformMovieFunctionParameterInt(2)
				PushScaleformMovieFunctionParameterInt(tonumber(Back))
				BeginTextCommandScaleformString("STRING")
				if mainMenu or loginMenu or registerMenu then
					AddTextComponentScaleform(GetLabelText("IB_QUIT"))
				else
					AddTextComponentScaleform(GetLabelText("IB_BACK"))
				end
				EndTextCommandScaleformString()	
				PopScaleformMovieFunctionVoid()

				PushScaleformMovieFunction(ScaleformMovie, "DRAW_INSTRUCTIONAL_BUTTONS")
				PopScaleformMovieFunctionVoid()
				PushScaleformMovieFunction(ScaleformMovie, "SET_BACKGROUND_COLOUR")
				PushScaleformMovieFunctionParameterInt(0)
				PushScaleformMovieFunctionParameterInt(0)
				PushScaleformMovieFunctionParameterInt(0)
				PushScaleformMovieFunctionParameterInt(60)
				PopScaleformMovieFunctionVoid()
				
				if not Time then
					Time = GetGameTimer()
				end
				if GetGameTimer() - Time >= 30000 then
					InstructionsDraw = false
					Time = nil
				end
			end

			if IsPauseMenuActive() then
				AddOnVehiclesMenu = false
				AddOnVehiclesSpawn = false
				AddOnVehiclesSpawnSettings = false
			end
		end
	end
end)

RegisterNetEvent('AOVSM:GotVehicles')
AddEventHandler('AOVSM:GotVehicles', function(AddOnVehicles)
	AddOnVehiclesTable = {}
	
	local AddOnVehiclesSplitted = stringsplit(AddOnVehicles, '\n')
	MaximumAddOns = #AddOnVehiclesSplitted / 2
	
	for i = 1, #AddOnVehiclesSplitted, 2 do
		local SpawnName = AddOnVehiclesSplitted[i]:gsub('SpawnName:', ''):gsub(' ', '', 1)
		local DisplayName = AddOnVehiclesSplitted[i + 1]:gsub('DisplayName:', ''):gsub(' ', '', 1)
		if (SpawnName ~= '' and not SpawnName:find('SpawnName')) and (DisplayName ~= '' and not DisplayName:find('DisplayName')) then
			DisplayName = DisplayName:sub(1, 42)
			table.insert(AddOnVehiclesTable, {SpawnName, DisplayName})
		end
	end
end)

-- >> Actual Menu

-- Functions <<

function DoesClassExist(Class)
	for k, vehicle in ipairs(AddOnVehiclesTable) do
		if GetVehicleClassFromName(GetHashKey(vehicle[1])) == Class then
			return true
		end
	end
	return false
end

function GetVehiclesOfClass(Class)
	AddOnVehiclesSubTable = {}
	
	for k, vehicle in ipairs(AddOnVehiclesTable) do
		if GetVehicleClassFromName(GetHashKey(vehicle[1])) == Class then
			table.insert(AddOnVehiclesSubTable, vehicle)
		end
	end
end

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

function GetIsControlPressed(Control)
	if IsControlPressed(1, Control) or IsDisabledControlPressed(1, Control) then
		return true
	end
	return false
end

function GetIsControlJustPressed(Control)
	if IsControlJustPressed(1, Control) or IsDisabledControlJustPressed(1, Control) then
		return true
	end
	return false
end

function KeyboardInput(TextEntry, ExampleText, MaxStringLenght, NoSpaces)
	AddTextEntry(GetCurrentResourceName() .. '_KeyboardHead', TextEntry)
	DisplayOnscreenKeyboard(1, GetCurrentResourceName() .. '_KeyboardHead', '', ExampleText, '', '', '', MaxStringLenght)
	blockinput = true

	while UpdateOnscreenKeyboard() ~= 1 and UpdateOnscreenKeyboard() ~= 2 do
		if NoSpaces == true then
			drawNotification('~y~NO SPACES!')
		end
		Citizen.Wait(0)
	end
	
	if UpdateOnscreenKeyboard() ~= 2 then
		local result = GetOnscreenKeyboardResult()
		Citizen.Wait(500)
		blockinput = false
		return result
	else
		Citizen.Wait(500)
		blockinput = false
		return nil
	end
end
	
-- >> Functions
