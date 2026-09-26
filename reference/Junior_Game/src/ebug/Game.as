/**
 * @author sbbc231
 */
import mx.core.UIObject;
import ebug.*;

class ebug.Game extends UIObject{
	var gameState:Number;
	
	// store the offset from origin in pixels
	var screenTopLeft:Point;
	var screenBottomRight:Point;
	
	var playerName:String;
	var playerSex:String;
	
	var xOffset:Number;
	var yOffset:Number
	
	var scrollRight:Boolean;
	var scrollLeft:Boolean;
	var scrollUp:Boolean;
	var scrollDown:Boolean;
	var scrollSpeed:Number;
	
	var debug:Boolean;
	var debugTopLeftText:TextField;
	var debugTopRightText:TextField;
	
	var eventListener:Object;
	
	var dirtyScreen:Boolean;
	
	var busy:Boolean;
	var busyString:String;
	
	
	public function init():Void {
		this.debug = true;

		
		scrollDown = false;
		scrollUp = false;
		scrollLeft = false;
		scrollRight = false;
		scrollSpeed = 10;
		dirtyScreen = true;
		busy = false;
		busyString = "";
	}

	function main() {
		
	}	
	
	function moveScreenLeft(speed:Number):Void {
		if (speed == undefined) {
			speed = scrollSpeed;
		}
		screenTopLeft.xPos = screenTopLeft.xPos - speed;
		screenBottomRight.xPos = screenTopLeft.xPos + Constants.SCREEN_WIDTH;
	}
	function moveScreenRight(speed:Number):Void {
		if (speed == undefined) {
			speed = scrollSpeed;
		}
		screenTopLeft.xPos = screenTopLeft.xPos + speed;
		screenBottomRight.xPos = screenTopLeft.xPos + Constants.SCREEN_WIDTH;
	}
}