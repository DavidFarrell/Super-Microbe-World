#pragma strict

/*

This class shows a dialogue in a box showing how is talking. 

It recieves an array of Strings that will be the sucesion of sentences that will be said by one person, and they will be played sentence by sentence being each sentence written letter by letter.
Here is a wee explanation of the most relevant function and the use of the class. More information about each function can be found over its implementation.

	First of all we have to use SetSpeaker("Speaker") to say who is talking.
	Then we use AddTextToShow(argument) to add all the lines to the buffer, being "argument" an array of sentences to be played.
	Enable the text Box with EnableTextBox();
	Call ShowAllLines () for all the lines to be written in order in the screen. This function will enable the text box, write all the sentences, and disable the text box after.
	Disable the text Box with DisableTextBox();
	
For a better understanding of its usage see the commented method mytest below.

TODO There is a failure. The sentences to write are broken in lines each "maxLettersPerLine" characters no matter if words are broken in half. Check this later.

*/
public class TextBox extends MonoBehaviour{
	
	
	var upperLeftCornerSpeaker : Vector2;		//Position of the upper left corner of the text to say who is talking
	var textSizeSpeaker : Vector2;				//Size
	
	var upperLeftCorner : Vector2;				//Position of the upper left corner of the text label to write the dialogs
	var textSize : Vector2;						//Size of this label
	
	var style : GUIStyle;						//The style of the text. Can be set up in the inspector in unity.
	
	var bufferSize : int = 50;				//Size of the buffer that will contain the messages to display. 
	
	var lettersPerSecond : int = 20;		//Letters that will be written per second when writting the dialogues. The frequency of writing.
	private var period : float = 1 / lettersPerSecond;	//Inverse of the frequency. The period between the writing of each letter.
	
	
	private var maxLettersPerLine = 75;						//Max letters that will be in one written line
	private var maxLinesPerDialog = 4;						//Max lines per sentence that will be written
	
	private var textBuffer : TextBuffer;					//See the class TextBuffer below, at the end of this js file. It's a round buffer to manage all the sentences to show.
	
	private var textRectangleSprite : SpriteRenderer;		//Points to the sprite renderer so as we can enable or disable it

	private var enableLabels : boolean = false;
	
	private var speaker : String = "Game host";					//Field to write who is talking
	private var textToWrite : String = "This is the dialogue";	//Here will be written the sentences of the dialogue to show
	
	function Awake () {
	
		//Debug.Log("Rectangle: " + upperLeftCorner.x + ", " + upperLeftCorner.y + ", " + textSize.x + ", " + textSize.y);
		
		textRectangleSprite = gameObject.GetComponent(SpriteRenderer);
		
		if(textRectangleSprite == null) Debug.Log("textRectangleSprite not found!");
		
		textBuffer= new TextBuffer(bufferSize);
		
		DisableTextBox();
		
		//mytest();
	
	}
	
	function Start () {
		
		
	}

	function Update () {

	}

	function OnGUI () {
		
		if (enableLabels){
			GUI.Label(Rect(upperLeftCornerSpeaker.x, upperLeftCornerSpeaker.y, textSizeSpeaker.x, textSizeSpeaker.y), speaker, style);
			GUI.Label(Rect(upperLeftCorner.x, upperLeftCorner.y, textSize.x, textSize.y), textToWrite, style);
		}
	}
	
	/*public function mytest(){
	
		Debug.Log("Test Started");
		
		var lines : String[] = new String[5];
		lines[0] = "This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[1] = "This is the test line 2. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[2] = "This is the test line 3. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[3] = "This is the test line 4. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[4] = "This is the test line 5. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		 
		AddTextToShow(lines);
		
		EnableTextBox();
		
		yield ShowAllLines();
		
		DisableTextBox();
		
		Debug.Log("End of Test!");
	
	}*/
	
	//To write who is talking on top of the text box
	public function SetSpeaker(speakerToSet : String) {
		speaker = speakerToSet;
	}
	
	public function EnableTextBox(){
		
		textRectangleSprite.enabled = true;
		enableLabels = true;
	}
	
	public function DisableTextBox(){
		
		textRectangleSprite.enabled = false;
		enableLabels = false;
	}

	//Receives a String which is added to the textBuffer to be shown
	public function AddTextToShow (lines : String[]) : boolean {
		var correctlyDone : boolean = true;
		for (var line : String in lines){
			correctlyDone = textBuffer.push(line);
		}
		return correctlyDone;
	}
	
	//Show all the dialog line by line, waiting the player to click between lines, and writing each line letter by letter like "pokemon style".
	public function ShowAllLines () {
		var actualLine : String = "";
		EnableTextBox();
		while (!textBuffer.isEmpty()) {
		
			actualLine = textBuffer.pull();
			yield ShowActualLine(actualLine);
		
		}
		DisableTextBox();
		
		
		//End of the coroutine
	}
	
	//Used by ShowAllLines() to show the actual line
	private function ShowActualLine(actualLine : String) {
		var line : int = 0;
		var skipLimit : int = actualLine.Length / 2;
		textToWrite = "";
		for (var count : int = 0; count < actualLine.Length; count++){
			textToWrite = textToWrite + actualLine[count];
			
			if((count % maxLettersPerLine == 0) && (count != 0)){ 		//To add a line break every "maxLettersPerLine" letters
				textToWrite = textToWrite + "\n";
				line++;
				if (line == maxLinesPerDialog){							//If there is too many lines (more than "maxLinesPerDialog") it stops writing
					break;
				}
			}
			
			if (Input.anyKeyDown && count > skipLimit && !(count == actualLine.Length - 1)){	//To write all the letters at once when more than half of the text has been written and any key is pressed
				continue;
			}
			else{
				yield new WaitForSeconds(period);
			}
		}
		yield WaitForClick();
		//The coroutine finishes and the control is returned to the coroutine that called this function.
	}
	
	//Coroutine that will finished when the player presses any button of any controller (mouse, keyboard, game controller...)
	public function WaitForClick(){
	
		while (!Input.anyKeyDown){
			yield;
		}
		//Debug.Log("Key pressed");
	
	}
	
	/*
	
	This class is a circular buffer. A FIFO structure which main operations are:
	-TextBuffer() to instantiate a new buffer.
	-push() to add an element to de queue
	-pull() to get the first element added and delete it from the queue.
	-isEmpty() to chech if it's empty
	-isFull() to chech if it's full
	
	There is more information in the comments of each function below.
	*/
	public class TextBuffer /*extends ScriptableObject*/{
		
		private var maxElems : int;					//The max num of elements of the array
		private var textBuffer : String[];			//This string will contain the text that is to be displayed. It will always managed within this class, and modified from outside using the functions provided.
		private var first : int;					//Index of the first element stored
		private var last : int;						//Index of the last element stored
		public var numElems : int;					//Number of elems
		
		public function TextBuffer(size : int){
			
			textBuffer = new String[size];
			maxElems = size;
			first = 0;
			last = 0;
			numElems = 0;
		}
		
		public function isEmpty() : boolean {
			return (numElems == 0);
		}
		
		public function isFull() : boolean{
			return (numElems == maxElems);
		}
		
		//To add an element if possible (then will return true. False otherwise.)
		public function push (textToAdd : String) : boolean {
			
			if (!isFull()){
				textBuffer[last] = textToAdd;
				numElems++;
				last = (last + 1) % maxElems;
				return true;
			}
			else{
				Debug.LogError("Tried to add an object to the buffer when it was full.");
				return false;
			}
		}
		
		//To get the first element on the array. If the array is empty will return an empty array and an exception. 
		//CAUTION!! Check if the buffer is empty before calling this function!!!!
		public function pull() : String{
			
			if (!isEmpty()){
				var text : String = textBuffer[first];
				numElems--;
				first = (first + 1) % maxElems;
				return text;
			}
			else{
				Debug.LogError("Tried to pull an object from the buffer when it was empty.");
				return "";
			}
		
		}
		/*	Tests with the Queue
		
		
		
		Debug.Log("Is empty? " + testBuffer.isEmpty() + "Is full? " + testBuffer.isFull() + "Num elems: " + testBuffer.numElems);
		testBuffer.push("First message.");
		Debug.Log("Is empty? " + testBuffer.isEmpty() + "Is full? " + testBuffer.isFull() + "Num elems: " + testBuffer.numElems);
		testBuffer.push("second message.");
		Debug.Log("Is empty? " + testBuffer.isEmpty() + "Is full? " + testBuffer.isFull() + "Num elems: " + testBuffer.numElems);
		testBuffer.push("third message.");
		Debug.Log("Is empty? " + testBuffer.isEmpty() + "Is full? " + testBuffer.isFull() + "Num elems: " + testBuffer.numElems);
		
		Debug.Log("Trying to push when full: " + testBuffer.push("fourth message."));
		
		var message : String;
		while(!testBuffer.isEmpty()){
			Debug.Log("Messages: " + testBuffer.pull());
			Debug.Log("Is empty? " + testBuffer.isEmpty() + "Is full? " + testBuffer.isFull() + "Num elems: " + testBuffer.numElems);
		}
		
		Debug.Log("Trying to pull when empty: " + testBuffer.pull());
		
		*/
	}
	
}