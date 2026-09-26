

class ebug.general.EPhone extends MovieClip {
	var screen : MovieClip;
	var status : MovieClip;
	var bigScreen : MovieClip;
	var isLarge : Boolean = false;
	
	function EPhone() {
		screen = this["screen"];
		bigScreen = this["bigScreen"];
		bigScreen._visible = false;
		
	}
	
	function grow( screenName : String ) {
		this.gotoAndPlay("grow");
		isLarge = true;
		//bigScreen.attachMovie(screenName);
		bigScreen.gotoAndPlay(screenName);
		bigScreen._visible = true;
		screen._visible = false;
	}
	
	function shrink() {
		isLarge = false;
		bigScreen._visible = false;
		screen._visible = true;
		this.gotoAndPlay("shrink");
	}
	
	function message() {
		this.gotoAndPlay("message");
	}
}