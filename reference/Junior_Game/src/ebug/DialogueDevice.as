import ebug.*;

class ebug.DialogueDevice extends MovieClip {
	// -----------------------
	// Intervals
	private var textGrowTime:Number = 80;
	private var shadowFlashTime:Number = 200;
	private var dialogueInterval:Number; // used to store interval created by above
	
	// Questions
	private var questions:Array;
	private var questionBalloonMC:MovieClip;
	private var questionShadowMC:MovieClip;
	private var questionTextField:TextField;
	private var questionTextFormat:TextFormat;
	private var questionDirection:Boolean;
	
	// Answers
	private var answers:Array;
	private var answersBalloonMC:MovieClip;
	private var answersShadowClip:MovieClip;
	private var answersIdleTextFormat:TextFormat;
	private var answersHoverTextFormat:TextFormat;
	private var answersSelectTextFormat:TextFormat;
	private var answersDirection:Boolean;
	private var answersMaxChars:Number;
	private var answerInput:Boolean;
	private var answersKeyListener:Object;
	
	// Callback to a function
	private var callbackFunction:Function;
	// Callback to an object method
	private var callbackObject:Object;
	private var callbackMethod:String;	

	// State
	private var currentLine:Number;
	private var displayText:String;
	private var writingQuestion:Boolean;
	private var shadowVisible:Boolean;
	private var answerSelected:Boolean;
	
	// Static vars
	public static var DIRECTION_RIGHT:Boolean = true;
	public static var DIRECTION_LEFT:Boolean = false;
	public static var QUESTIONS:Number =0;
	public static var ANSWERS:Number = 1;
	public static var VISIBLE_MATRIX:Number = 2;
	
	
	
	// -----------------------
	// Public Methods
	
	public function setCallbackFunction(newCallbackFunction:Function):Void {
		callbackFunction = newCallbackFunction;
		callbackObject = null;
		callbackMethod = "";
	}
	public function setCallbackObjectMethod(newCallbackObject:Object, newCallbackMethod:String):Void {
		callbackFunction = null;
		callbackObject = newCallbackObject;
		callbackMethod = newCallbackMethod;
	}
	public function setQuestionCoords(xPos:Number, yPos:Number):Void {
		questionBalloonMC._x = xPos;
		questionBalloonMC._y = yPos;
		questionShadowMC._x = xPos + 2;
		questionShadowMC._y = yPos + 2;
		questionTextField._x = xPos + 10;
		questionTextField._y = yPos + 10;
	}
	public function setTails(qDir:Boolean, aDir:Boolean):Void {
		questionDirection = qDir;
		answersDirection = aDir;
	}
	public function setAnswerCoords(xPos:Number, yPos:Number):Void {
		answersBalloonMC._x = xPos;
		answersBalloonMC._y = yPos;
		answersShadowClip._x = xPos + 2;
		answersShadowClip._y = yPos + 2;
	}
	public function setQuestions(newQuestions:Array):Void {
		questions = newQuestions;
		answers = null;
		answerInput = false;
		start();
	}
	public function setQuestionsAndAnswers(newQuestions:Array, newAnswers:Array):Void {
		questions = newQuestions;
		answers = newAnswers;
		answerInput = false;
		start();
	}
	public function setQuestionsAndInput(newQuestions:Array, max:Number):Void {
		questions = newQuestions;
		answers = null;
		answerInput = true;
		answersMaxChars = max;
		start();
	}
	private function clear():Void {
		answersBalloonMC.clear();
		answersShadowClip.clear();
		answersBalloonMC.aRoot.removeMovieClip();
		questionBalloonMC.clear();
		questionShadowMC.clear();
		clearInterval(dialogueInterval);
	}
	// -----------------------
	// Private Methods	
	public function DialogueDevice() {
		trace("created DD" );
		// Questions
		this.questionShadowMC = this.createEmptyMovieClip("questionShadowMC", getNextHighestDepth());
		this.questionBalloonMC = this.createEmptyMovieClip("questionBalloonMC", getNextHighestDepth());
		createTextField("questionTextField", getNextHighestDepth(), 10, 10, 50, 50);
		questionTextField.selectable = false;
		questionTextField.multiline = true;
		questionTextField.html = true;
		questionTextField.autoSize = true;
		questionTextFormat = new TextFormat();
		questionTextFormat.font = "Arial";
		questionTextFormat.size = 16;
		questionTextFormat.color = 0x000000;
		questionDirection = false;
		// Answers
		this.answersShadowClip = this.createEmptyMovieClip("answersShadowClip", getNextHighestDepth());
		this.answersBalloonMC = this.createEmptyMovieClip("answersBalloonMC", getNextHighestDepth());
		answersIdleTextFormat = new TextFormat();
		answersIdleTextFormat.font = "Arial";
		answersIdleTextFormat.size = 16;
		answersIdleTextFormat.color = 0x000000;
		answersHoverTextFormat = new TextFormat();
		answersHoverTextFormat.font = "Arial";
		answersHoverTextFormat.size = 16;
		answersHoverTextFormat.color = 0xF71B1B;
		answersSelectTextFormat = new TextFormat();
		answersSelectTextFormat.font = "Arial";
		answersSelectTextFormat.size = 16;
		answersSelectTextFormat.color = 0x880000;
		answersDirection = false;
		// Create a listener to spot when enter key pressed
		answersKeyListener = new Object();
		answersKeyListener._parent = this;
		answersKeyListener.onKeyDown = function() {
			if (Key.getAscii() == Key.ENTER) {
				this._parent.onPressSelect();
			}
		};
		//questionShadowMC._focusrect = true;
		//questionShadowMC.focusEnabled = true;
		Key.addListener(answersKeyListener);
		//Selection.setFocus(questionShadowMC);
	}
	private function start():Void {
		clear();
		currentLine = 0;
		displayText = "";
		questionTextField.htmlText = "";
		writingQuestion = true;
		dialogueInterval = setInterval(this, "growQuestionText", textGrowTime);
	}
	private function writeAnswers():Void {
		// Create a text field for each answer
		var aRoot:MovieClip = answersBalloonMC.createEmptyMovieClip("aRoot", getNextHighestDepth());
		var txtH:Number = 0;
		var txtW:Number = 0;
		if (answers != null) {
			for (var a:Number = 0; a < answers.length; a++) {
				// each answer consists of a movie clip that contains a text field
				// this is because movie clips get mouse events whereas text fields do not
				var answerName:String = "answer"+a;
				var answerMC:MovieClip = aRoot.createEmptyMovieClip(answerName, aRoot.getNextHighestDepth());
				answerMC._x = 10;
				answerMC._y = txtH + 10;
				answerMC.createTextField("aTextField", answerMC.getNextHighestDepth(), 0, 0, 50, 50);			
				var aTextField:TextField = answerMC["aTextField"];
				aTextField.selectable = false;
				aTextField.multiline = true;
				aTextField.html = true;
				aTextField.autoSize = true;
				aTextField.htmlText = answers[a];
				aTextField.setTextFormat(answersIdleTextFormat);
				answerMC._width = aTextField._width;
				answerMC._height = aTextField._height;
				txtH += aTextField._height;
				if (aTextField._width>txtW) {
					txtW = aTextField._width;
				}
				answerMC.onPress = function():Void  {
					if (this._parent._parent._parent.answerSelected == false) {
						this["aTextField"].setTextFormat(this._parent._parent._parent.answersSelectTextFormat);
						this._parent._parent._parent.onPressAnswer(this._name);
					}
				};
				answerMC.onRollOver = function():Void  {
					if (this._parent._parent._parent.answerSelected == false) {
						this["aTextField"].setTextFormat(this._parent._parent._parent.answersHoverTextFormat);
					}
				};			
				answerMC.onRollOut = function():Void  {
					if (this._parent._parent._parent.answerSelected == false) {
						this["aTextField"].setTextFormat(this._parent._parent._parent.answersIdleTextFormat);
					}
				};
			}
			trace ("after answers");
			
		} else {				
				// input field consists of a movie clip that contains an input text field
				// this is because movie clips get mouse events whereas text fields do not
				var maxStr:String = "";
				for (var i:Number = 0; i < answersMaxChars+1; i++) {
					maxStr += "W";
				}
				var answerName:String = "answer0";
				var answerMC:MovieClip = aRoot.createEmptyMovieClip(answerName, aRoot.getNextHighestDepth());
				answerMC._x = 10;
				answerMC._y = txtH + 10;				
				answerMC.createTextField("aTextField", answerMC.getNextHighestDepth(), 0, 0, 50, 50);			
				var aTextField:TextField = answerMC["aTextField"];
				aTextField.type = "input";
				aTextField.maxChars = answersMaxChars;
				aTextField.setNewTextFormat(answersIdleTextFormat);
				aTextField.autoSize = true;
				aTextField.text = maxStr;
				txtH += aTextField._height;
				txtW = aTextField._width;
				aTextField.autoSize = false;
				aTextField._width = txtW;
				aTextField._height = txtH;
				aTextField.text = "";
				aTextField.setNewTextFormat(answersIdleTextFormat);
				Selection.setFocus(aTextField);
		}
		//Build the Balloon
		with (this.answersShadowClip) {
			lineStyle(4, 0x000000, 30);
			moveTo(txtW, 0);
			curveTo(txtW+20, 0, txtW+20, 20);
			lineTo(txtW+20, txtH);
			curveTo(txtW+20, txtH+20, txtW, txtH+20);
			var tailX:Number = 25;
			if (_parent.answersDirection) {
				tailX = txtW - 25;
			}
			lineTo(tailX + 5, txtH+20);
			lineTo(tailX, txtH+30);
			lineTo(tailX - 5, txtH+20);
			lineTo(20, txtH+20);
			curveTo(0, txtH+20, 0, txtH);
		}
		with (answersBalloonMC) {
			beginFill(0xFFF76F, 100);
			lineStyle(4, 0x000000, 100);
			moveTo(20, 0);
			lineTo(txtW, 0);
			curveTo(txtW+20, 0, txtW+20, 20);
			lineTo(txtW+20, txtH);
			curveTo(txtW+20, txtH+20, txtW, txtH+20);
			var tailX:Number = 25;
			if (_parent.answersDirection) {
				tailX = txtW - 25;
			}
			lineTo(tailX + 5, txtH+20);
			lineTo(tailX, txtH+30);
			lineTo(tailX - 5, txtH+20);
			lineTo(20, txtH+20);
			curveTo(0, txtH+20, 0, txtH);
			lineTo(0, 20);
			curveTo(0, 0, 20, 0);
			endFill();
		}
		writingQuestion = false;
		answerSelected = false;
		questionBalloonMC.onPress = null;
		questionBalloonMC.useHandCursor = false;
		clearInterval(dialogueInterval);
		dialogueInterval = setInterval(this, "flashShadow", shadowFlashTime);
	}
	private function sizeToCurrentQuestion():Void {
		questionTextField.htmlText = questions[currentLine];
		questionTextField.setTextFormat(questionTextFormat);
		//The Width and Height of the Dynamic Textfield
		var txtW = questionTextField._width;
		var txtH = questionTextField._height;
		//Blank the text
		questionTextField.htmlText = "";
		//Build the Balloon
		with (questionShadowMC) {
			clear();
			lineStyle(4, 0x000000, 30);
			moveTo(txtW, 0);
			curveTo(txtW+20, 0, txtW+20, 20);
			lineTo(txtW+20, txtH);
			curveTo(txtW+20, txtH+20, txtW, txtH+20);
			var tailX:Number = 25;
			if (_parent.questionDirection) {
				tailX = txtW - 25;
			}
			lineTo(tailX + 5, txtH+20);
			lineTo(tailX, txtH+30);
			lineTo(tailX - 5, txtH+20);
			lineTo(20, txtH+20);
			curveTo(0, txtH+20, 0, txtH);
		}
		with (questionBalloonMC) {
			clear();
			beginFill(0xffffff, 100);
			lineStyle(4, 0x000000, 100);
			moveTo(20, 0);
			lineTo(txtW, 0);
			curveTo(txtW+20, 0, txtW+20, 20);
			lineTo(txtW+20, txtH);
			curveTo(txtW+20, txtH+20, txtW, txtH+20);
			var tailX:Number = 25;
			if (_parent.questionDirection) {
				tailX = txtW - 25;
			}
			lineTo(tailX + 5, txtH+20);
			lineTo(tailX, txtH+30);
			lineTo(tailX - 5, txtH+20);
			lineTo(20, txtH+20);
			curveTo(0, txtH+20, 0, txtH);
			lineTo(0, 20);
			curveTo(0, 0, 20, 0);
			endFill();
		}
		questionShadowMC._visible = true;
		writingQuestion = true;
		shadowVisible = true;
		questionBalloonMC.onPress = function():Void  {
			this._parent.onPressQuestion();
		};
		questionBalloonMC.useHandCursor = true;
	}
	private function growQuestionText() {
		if (writingQuestion) {
			if (displayText == "") {
				sizeToCurrentQuestion();
			}
			if (displayText.length<questions[currentLine].length) {
				// Add another character on
				var char = questions[currentLine].charAt(displayText.length);
				// if its the start of a HTML tag then add the whole tag
				if (char == '<') {
					while (char != '>') {
						displayText += char;
						char = questions[currentLine].charAt(displayText.length);
					}
				}
				displayText += char;
				// Work around for bug in Flash html text formatting
				// Need to add a closing </b><i> otherwise an unclosed tag once encountered will
				// permanently toggle whole field to that format
				questionTextField.htmlText = displayText+"</b></i>";
				questionTextField.setTextFormat(questionTextFormat);
			} else if (currentLine == questions.length-1 && (answers != null || answerInput)) {
				// no more question lines so display the answers
   				clearInterval(dialogueInterval);
				writeAnswers();
			} else {
				// flash question shadow
   				clearInterval(dialogueInterval);
   				dialogueInterval = setInterval(this, "flashShadow", shadowFlashTime);
			}
		}
	}
	private function flashShadow() {
		shadowVisible = !shadowVisible;
		if (writingQuestion) {
			questionShadowMC._visible = shadowVisible;
		} else {
			answersShadowClip._visible = shadowVisible;
		}
	}
	private function onPressQuestion():Void {
		if (displayText.length>=questions[currentLine].length) {
			// already completed current line
			if (currentLine<questions.length-1) {
				// move to next question line and start growing the text again
				currentLine++;
				displayText = "";
				clearInterval(dialogueInterval);
				dialogueInterval = setInterval(this, "growQuestionText", textGrowTime);
			} else if (answers == null && !answerInput) {
				if (callbackObject != null) {
					callbackObject[callbackMethod]("");
				} else if (callbackFunction != null) {
					callbackFunction("");
				}
			}
		} else {
			// complete the current text when clicked
			displayText = questions[currentLine];
			questionTextField.htmlText = displayText;
			questionTextField.setTextFormat(questionTextFormat);
		}
	}
	private function onPressAnswer(chosenAnswerName:String):Void {
		if (answerSelected == false) {
			clearInterval(dialogueInterval);
			answerSelected = true;
			// remove the hand cursor from each answer
			for (var a:Number = 0; a<answers.length; a++) {
				var answerName:String = "answer"+a;
				this["answersBalloonMC"]["aRoot"][answerName].useHandCursor = false;			
			}
			// callback
			if (callbackObject != null) {
				callbackObject[callbackMethod](chosenAnswerName);
			} else if (callbackFunction != null) {
				callbackFunction(chosenAnswerName);
			}
		}
	}
	private function onPressSelect():Void {
		if (writingQuestion) {
			onPressQuestion();
		}
		if (answerInput && answerSelected == false) {
			clearInterval(dialogueInterval);
			answerSelected = true;
			//Key.removeListener(answersKeyListener);
			var aTextField:TextField = this["answersBalloonMC"]["aRoot"]["answer0"]["aTextField"];
			// callback
			if (callbackObject != null) {
				callbackObject[callbackMethod](aTextField.text);
			} else if (callbackFunction != null) {
				callbackFunction(aTextField.text);
			}
		}
	}
	
	// TODO: write a proper clean up that gurantees all arrays and clips etc are killed - I don't trust flash's garbage collection
	public function cleanup() {
		this.questionTextField.removeTextField();
	}
}
