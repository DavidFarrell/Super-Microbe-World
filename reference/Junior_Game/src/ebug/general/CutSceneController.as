class ebug.general.CutSceneController extends MovieClip{
	var backgrounds : Array;
	var actors : Array;
	var conversations : Array;
	var sceneEvents : Array;
	var customEvents : Array;
	var currentEvents : Array;
	
	var counter : Number;
	
	function CutSceneController() {
		trace ("Hello");
		counter = 0;
		backgrounds = new Array();

	}
	
	function main() {
		counter++;
		this._parent[backgrounds[0]]._visible = false;
		//this._parent[backgrounds[1]]._visible = false;
		//this._parent["gameshow_set"]._visible = false;
		//_root["gameshow_set"]._visible = false;
		trace (backgrounds[1]);
		if (counter == 100) {
			trace ("goto shrink");
			_parent.gotoAndPlay("shrinking_zone");
			var str = backgrounds[1];
			this._parent["gameshow_set"]._visible = false;
		}
	}
	
	
}