#pragma strict

public class GUIHandler extends MonoBehaviour{

	private var numImagesPhone: int;
	//imagesLx will contain the images to be displayed on the phone for the level x. They will be displayed in order. The size of each array must be adjusted in the editor.
	public var imagesL1: Texture2D[] = new Texture2D[numImagesPhone];
	public var imagesL2: Texture2D[] = new Texture2D[numImagesPhone];
	public var imagesL3: Texture2D[] = new Texture2D[numImagesPhone];
	public var imagesL4: Texture2D[] = new Texture2D[numImagesPhone];
	public var imagesL5: Texture2D[] = new Texture2D[numImagesPhone];
	
	private var infoImageWidth: int;
	private var infoImageHeigth: int;
	public var infoImagePos: Vector2;
	private var showInfoImage: boolean; //Will be used to enable/disable showing the info images in the OnGUI() function
	
	private var currentLevel: int;
	private var currentArrayIm: Texture2D[];
	private var currentImageNum: int;
	private var currentImage: Texture2D;
	
	public var lives: int;					//NOTE: switch to private!
	public var livesImg: Texture2D;
	public var livesPosHeight: int;
	public var livesPos1x: int;
	public var livesPos2x: int;
	public var livesPos3x: int;
	private var liveswidth: int;
	private var livesheight: int;
	
	public var antibiotic: int;				//NOTE: switch to private!
	public var antibioticImg: Texture2D;
	public var antibioticPos: Vector2;
	private var antibioticwidth: int;
	private var antibioticheight: int;
	
	public var InGamePhone: GameObject;		//The phone
	private var phoneAnim : Animator;	//The Animator component attached to the InGamePhone GameObject
	
	private var widthScreen: int;
	private var heightScreen: int;
	
	private var gameLogic: GameLogic;		//Keeps a reference of the gameLogic object
	
	function Start () {
	
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		widthScreen = Screen.width;
		heightScreen = Screen.height;
		
		infoImageWidth = imagesL1[0].width;
		infoImageHeigth = imagesL1[0].height; 
		
		liveswidth = livesImg.width;
		livesheight = livesImg.height;
		
		antibioticwidth = antibioticImg.width;
		antibioticheight = antibioticImg.height;
		
		//InGamePhone = Instantiate(InGamePhone);
		InGamePhone = transform.Find("InGamePhone").gameObject;
		if(!InGamePhone) Debug.LogError("InGamePhone not found. Drag and drop the InGamePrefab to the public variable of the GUIHandler script attached to the GUI object in the editor.");
		else phoneAnim = InGamePhone.GetComponent(Animator);
		
		test();
	}
	
	private function test(){
		Debug.Log("Waiting 0.5 seconds...");
		yield new WaitForSeconds(0.5);
		Debug.Log("Showing questions...");
		showInfoLevel(1);
	}
	
	function Update () {
		
	}
	
	//MonoBehaviour's class to manage the GUI
	public function OnGUI(){
		if (lives>0) GUI.Label (Rect (livesPos1x,livesPosHeight,liveswidth,livesheight), livesImg);		//First heart
		if (lives>1) GUI.Label (Rect (livesPos2x,livesPosHeight,liveswidth,livesheight), livesImg);		//Second heart
		if (lives>2) GUI.Label (Rect (livesPos3x,livesPosHeight,liveswidth,livesheight), livesImg);		//First heart
		if (antibiotic > 0) GUI.Label (Rect (antibioticPos.x,antibioticPos.y,antibioticwidth,antibioticheight), antibioticImg);
		if (showInfoImage)
			if (GUI.Button (Rect (infoImagePos.x, infoImagePos.y, infoImageWidth, infoImageHeigth), currentImage)) {
				print ("Next image");
				showNextInfoImage();
			}
	}
	
	/*
		This function will display the mobile phone with the information for the level selected.
	*/
	public function showInfoLevel(level: int){
		
		currentLevel = level;
		switch (level){
			case 1:
				currentArrayIm = imagesL1;
				break;
			case 2:
				currentArrayIm = imagesL2;
				break;
			case 3:
				currentArrayIm = imagesL3;
				break;
			case 4:
				currentArrayIm = imagesL4;
				break;
			case 5:
				currentArrayIm = imagesL5;
				break;
			default:
				currentArrayIm = imagesL1;
				Debug.LogError("There isn't round number " + level + ". The rounds go from 1 to 5.");
		}
		currentImageNum = 0;
		phoneAnim.SetTrigger("PhoneBig");	//To make it small again the trigger is "PhoneSmall"
		yield new WaitForSeconds(0.2);		//0.2 is the time the animation takes to be played
		showNextInfoImage();
	}
	
	private function showNextInfoImage(){
		if(currentImageNum < currentArrayIm.length){		//There is still at least one more image to show
			currentImage = currentArrayIm[currentImageNum];
			showInfoImage = true;
			currentImageNum++;
		}else{													//Finished showing the information images
			showInfoImage = false;
			currentImage = null;
			phoneAnim.SetTrigger("PhoneSmall");
			//Inform somewhere that info has finished to be displayed.
		}
	}
	
}///End of class