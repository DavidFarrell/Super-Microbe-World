import flash.geom.ColorTransform;

class ColourSwap extends MovieClip{
	var darkGreenTransform:ColorTransform;
	var lightGreenTransform:ColorTransform;
	var pinkTransform:ColorTransform;
	var yellowTransform:ColorTransform; 
	var orangeTransform:ColorTransform;  
	var blueTransform:ColorTransform;
	var skinTransform:ColorTransform;
	
	var params:LoadVars;
	
	function ColourSwap(topMC:MovieClip) {
		params = _root.paramContainer;
		if (params.done == undefined) {
			//trace ("Root has not finished loading parameters yet.");	
		}	else {
			darkGreenTransform = new ColorTransform();
			lightGreenTransform = new ColorTransform();
			pinkTransform = new ColorTransform();
			yellowTransform = new ColorTransform();
			orangeTransform = new ColorTransform();
			blueTransform = new ColorTransform();
			skinTransform = new ColorTransform();
			
			// TODO - these are hardcoded (except skin) - should be drawn from load vars
			skinTransform.rgb = params.skin;
			darkGreenTransform.rgb = 0x2A7996;
			lightGreenTransform.rgb = 0x6CC1E0;
			pinkTransform.rgb = 0xFF0505;
			yellowTransform.rgb = 0xC1FF05;
			orangeTransform.rgb = 0xFFFF80;	
			blueTransform.rgb = 0x400040;
			
			convertColours(topMC);
		}
	}
	
	function convertColours(topMC:MovieClip):Void {
		var clips:Array = new Array();
		clips.push(topMC);
		while (clips.length > 0) {
			var currentMC:MovieClip = MovieClip(clips.pop());
			
			// add child MC's to array - will only find MCs at this level, none inside arrays or objects
			// we WILL find MC's inside MC's because thay are added to clips array.
			for (var nextItem in currentMC) {
				if ((currentMC[nextItem] instanceof MovieClip)) {
					clips.push(currentMC[nextItem]);
				}
			}
			
			// look for keywords and transform as appropriate
			switch ( currentMC.eBugColour) {
				case "skin":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = skinTransform;
					break;
				case "orange":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = orangeTransform;
					break;
				case "dark_green":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = darkGreenTransform;
					break;
				case "light_green":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = lightGreenTransform;
					break;
				case "pink":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = pinkTransform;
					break;
				case "yellow":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = yellowTransform;
					break;
				case "blue":
					//trace (currentMC._name);
					currentMC.transform.colorTransform = blueTransform;
					break;
				default:
					if ( currentMC.eBugColour != undefined) {
						trace ( "Unknown colour: " + currentMC.eBugColour + " in clip " + currentMC._name + " / " + topMC);
					}
					break;				
			}
		} // end while
	}
		
		
}