#pragma strict

/*

This class +-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-COMMENT THIS CLASS WHEN FINISHED*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*+-*

*/
public class TextBox extends MonoBehaviour{
	
	var speaker : String = "Game host";			//Field to write who is talking
	var upperLeftCornerSpeaker : Vector2;		//Position of the upper left corner of the text to say who is talking
	var textSizeSpeaker : Vector2;				//Size
	
	var textToWrite : String = "This is the dialogue";	//Here will be written the sentences of the dialogue to show
	var upperLeftCorner : Vector2;				//Position of the upper left corner of the text label to write the dialogs
	var textSize : Vector2;						//Size of this label
	
	var style : GUIStyle;						//The style of the text. Can be set up in the inspector in unity.
	
	var bufferSize : int = 50;				//Size of the buffer that will contain the messages to display. 
	
	var lettersPerSecond : int = 20;		//Letters that will be written per second when writting the dialogues. The frequency of writing.
	private var period : float = 1 / lettersPerSecond;	//Inverse of the frequency. The period between the writing of each letter.
	
	
	private var maxLettersPerLine = 75;
	private var maxLinesPerDialog = 4;
	
	private var textBuffer : TextBuffer;

	

	function Start () {
		//Debug.Log("Rectangle: " + upperLeftCorner.x + ", " + upperLeftCorner.y + ", " + textSize.x + ", " + textSize.y);
		
		textBuffer= new TextBuffer(50);
		
		mytest();
		
	}

	function Update () {

	}

	function OnGUI () {

		GUI.Label(Rect(upperLeftCornerSpeaker.x, upperLeftCornerSpeaker.y, textSizeSpeaker.x, textSizeSpeaker.y), speaker, style);
		GUI.Label(Rect(upperLeftCorner.x, upperLeftCorner.y, textSize.x, textSize.y), textToWrite, style);

	}
	
	public function mytest(){
	
		Debug.Log("Test Started");
		
		var lines : String[] = new String[5];
		lines[0] = "This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[1] = "This is the test line 2. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[2] = "This is the test line 3. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[3] = "This is the test line 4. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		lines[4] = "This is the test line 5. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. This is the test line 1. ";
		 
		AddTextToShow(lines);
		
		yield ShowAllLines();
		
		Debug.Log("The end!");
	
	}

	//Receives a String which is added to the textBuffer to be shown
	public function AddTextToShow (lines : String[]) : boolean {
		var correctlyDone : boolean = true;
		for (var line : String in lines){
			correctlyDone = textBuffer.push(line);
		}
		return correctlyDone;
	}
	
	public function ShowAllLines () {
		var actualLine : String = "";
		while (!textBuffer.isEmpty()) {
		
			actualLine = textBuffer.pull();
			yield ShowActualLine(actualLine);
		
		}
		
		
		
		//End of the coroutine
	}
	
	//Changes the 
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
			
			if (Input.anyKeyDown && count > skipLimit){					//To write all the letters at once when more than half of the text has been written and any key is pressed
				continue;
			}
			else{
				yield new WaitForSeconds(period);
			}
		}
		yield WaitForClick();
		//The coroutine finishes and the control is returned to the coroutine that called this function.
	}
	
	public function WaitForClick(){
	
		while (!Input.anyKeyDown){
			yield;
		}
		Debug.Log("Key pressed");
	
	}
	
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