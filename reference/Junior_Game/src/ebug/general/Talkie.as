
/**
 * @author sbbc231
 */

class ebug.general.Talkie extends MovieClip {
	var speaker : TextField;
	var statementTextField : TextField;
	var statement : String;
	var statementSoFar : Number;
	var counter : Number;
	var speed : Number;
	var nextState : String;
	var callbackObject : Object;
	var callbackFunction : Function;
	var callbackMethod : String;
	var bigInvisibleButton : Button;
	var state : String;
	
	public function Talkie () {
		speaker = this["speaker_box"];
		statementTextField = this["statement_text_field"];
		statement = "";
		statementSoFar = 0;
		counter = 0;
		speed = 1;
		nextState = "init";
		callbackObject = null;
		callbackMethod = null;
		bigInvisibleButton = this["big_invisible_button"];
		bigInvisibleButton.onRelease = buttonClick;
		state = "init";
	}
	
	/*
	 * If control should pass to an object method, leave inFunc blank and provide an object and the String of the function
	 * else, just pass a direct ref to the function to call - but beware that when this function is called, it will be called by 
	 * talkie - and thus won't have access to any variables outside iteself.
	 */
	public function init(speakerName : String, inStatement : String, inState : String, inNextState : String, inFunc : Function, inObj : Object, inMethod : String) {
		gotoAndStop(inState);
		state = inState;
		statementTextField = this["statement_text_field"];
		statementTextField.text = "df";
		bigInvisibleButton = this["big_invisible_button"];
		bigInvisibleButton.onRelease = buttonClick;
		
		speaker.text = speakerName;
		statement = inStatement;
		nextState = inNextState;
		callbackObject = inObj;
		callbackFunction = inFunc;
		callbackMethod = inMethod;
		
		counter = 0;
		statementSoFar = 0;
		
		onEnterFrame = update;
		play();
	}
	
	public function update() {
		counter++;
		if (counter >= speed) {
			statementSoFar ++;
			statementTextField.text = statement.substr(0, statementSoFar);
			counter = 0;
		}
		if (statementSoFar >= statement.length) {
			if (state == "start") {
				gotoAndPlay(nextState);
				nextState = "end";
			}
			onEnterFrame = null;
		}
		var test : TextField;
	}
	
	/*
	 * this function is called when the big invisible button is clicked 
	 * this is why all the variables are preferenced by _parent
	 * 
	 * Note that if we have a callback object, then we use the String for method call - else we just call the FUNCTION directly
	 * */
	public function buttonClick() {
		if (_parent.statementSoFar >= _parent.statement.length) {
			if ( _parent.nextState == "end" ) {
				if ( _parent.callbackObject != null && _parent.callbackObject != undefined) {
					_parent.callbackObject[_parent.callbackMethod]();
				} else {
					_parent.callbackFunction();
				}
			} else {
				_parent.gotoAndPlay(_parent.nextState);
			}
		} else {
			_parent.statementSoFar = _parent.statement.length;
		}
	}
}