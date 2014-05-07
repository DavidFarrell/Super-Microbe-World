#pragma strict

public class GUIHandler extends MonoBehaviour{		//Yes, I know that handler is not the best name for this script... Should have been controller, but when I realized it was too late :)

	//private var numImagesPhone: int;
	//imagesLx will contain the images to be displayed on the phone for the level x. They will be displayed in order. The size of each array must be adjusted in the editor.
	public var infoKitchen1: Texture2D[] = new Texture2D[7];			//Information pictures for the level kitchen1
	public var infoSkin1: Texture2D[] = new Texture2D[2];
	public var infoSkin2: Texture2D[] = new Texture2D[2];
	public var infoKitchen2: Texture2D[] = new Texture2D[2];
	//------------------------------------
	public var infoSkin11: Texture2D[] = new Texture2D[2];
	public var infoSkin12: Texture2D[] = new Texture2D[3];
	public var infoBody11: Texture2D[] = new Texture2D[4];
	//------------------------------------
	public var infoKitchen31: Texture2D[] = new Texture2D[3];
	public var infoKitchen32: Texture2D[] = new Texture2D[2];
	//------------------------------------
	public var infoSuperinfection: Texture2D[] = new Texture2D[6];
	
	private var infoImageWidth: int;
	private var infoImageHeigth: int;
	public var infoImagePos: Vector2;
	private var showInfoImage: boolean; //Will be used to enable/disable showing the info images in the OnGUI() function
	
	private var currentLevel: String;
	private var currentArrayIm: Texture2D[];
	private var currentImageNum: int;
	private var currentImage: Texture2D;
	
	private var lives: int;					//Amount of lives remaining
	public var livesImg: Texture2D;
	public var livesPosHeight: int;
	public var livesPos1x: int;
	public var livesPos2x: int;
	public var livesPos3x: int;
	private var liveswidth: int;
	private var livesheight: int;
	
	private var antibiotic: int;				//Amount of antibiotics remaining
	public var antibioticImg: Texture2D;
	public var antibioticPos: Vector2;
	private var antibioticwidth: int;
	private var antibioticheight: int;
	
	//---------Goals----------------
	public var greenCheck: Sprite;			//Texture for the green check
	public var redCheck: Sprite;				//Texture for the green check
	public var totalGoals: int;				//Normally there will be 3 goals, but there can be stages with just one goal... this var will control how much goals will be drawn
	public var goalsCompleted: int;			//From 0 to 3, number of completed goals
	private var actionToDo: int;			//Which action is the goal about: 0: photo, 1: wash up, 2: white blood cell, 3: antibiotics, 4: throw to yoghurt.
	
	//private var goalsArray: Sprite[] = new Sprite[3];		//array containing the 3 textures to be shown over the phone
	private var goalsArrayGO: GameObject[];
	private var currentGoalsGO: GameObject;
	private var currentMicrobeNum: int;							//Number of the microbe to be displayed over the phone
	private var currentMicrobeGO: GameObject;
	public var microbesSprites: Sprite[] = new Sprite[12];		//Textures of all the microbes to be displayed over the phone (each microbe on its number. Eg. 0 lucy, 1 patty and so on)
	public var yoghurtSprite: Sprite;
	public var portalSprite: Sprite;
	public var microbePos: Vector2;
	public var goalsPos: Vector2;
	//^^^^^^^^^^^Goals^^^^^^^^^^^^^
	
	private var whiteBloodCells: int;		//Amount of wbc remaining
	private var soapDrops: int;				//Number of remainig soap drops
	
	public var InGamePhone: GameObject;		//The phone
	private var phoneAnim : Animator;	//The Animator component attached to the InGamePhone GameObject
	private var idleAnimation: AnimationState;
	
	private var widthScreen: int;
	private var heightScreen: int;
	
	//private var gameLogic: GameLogic;		//Keeps a reference of the gameLogic object
	private var currentLevelLogicScript: LevelLogic;	//Keeps a reference to the LevelLogicxxxxxx.js script that called the showInfoLevel() function to notify the script when finished displaying the information
	
	/**Other vars**/
	private var firstRun = true;		//To perform some operations in the update function just the first loop 
	
	private var mytimer: float = 0;
	
	function Awake() {
	
		//gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		widthScreen = Screen.width;
		heightScreen = Screen.height;
		
		infoImageWidth = infoKitchen1[0].width;
		infoImageHeigth = infoKitchen1[0].height; 
		
		liveswidth = livesImg.width;
		livesheight = livesImg.height;
		
		antibioticwidth = antibioticImg.width;
		antibioticheight = antibioticImg.height;
		
		//InGamePhone will be created by LevelLogic Script
		var ingamephonetransform = transform.Find("InGamePhone");
		if (!ingamephonetransform) Debug.Log("InGamePhone not found!!!!");
		InGamePhone = ingamephonetransform.gameObject;
		if(!InGamePhone) Debug.LogError("InGamePhone not found. Drag and drop the InGamePrefab to the public variable of the GUIHandler script attached to the GUI object in the editor.");
		else{
			phoneAnim = InGamePhone.GetComponent(Animator);
		}
	
	}
	
	function Start () {
		
		
//		test();
	}
	
//	private function test(){
//		Debug.Log("Waiting 0.5 seconds...");
//		yield new WaitForSeconds(0.5);
//		Debug.Log("Showing questions...");
//		showInfoLevel(1, null);
//	}
	
	function Update () {
		if (firstRun){
			firstRun = false;
		}
		
		if(showInfoImage && Input.anyKeyDown){
			Debug.Log("Next image anyKeyDown");
			showNextInfoImage();
		}
		
		/*JUST FOR DEVELOPING*/
		
//		mytimer += Time.deltaTime;
//		if (mytimer >= 5){
//			mytimer = 0;
//			Debug.Log("GUIHandler.Update() working every 5 seconds...");
//			//ShowPhoneInfo();
//		}
		
		//currentMicrobeGO.transform.position = microbePos;
		
		/*JUST FOR DEVELOPING*/
		
	}//end update
	
	//MonoBehaviour's class to manage the GUI
	public function OnGUI(){
		if (lives>0) GUI.Label (Rect (livesPos1x,livesPosHeight,liveswidth,livesheight), livesImg);		//First heart
		if (lives>1) GUI.Label (Rect (livesPos2x,livesPosHeight,liveswidth,livesheight), livesImg);		//Second heart
		if (lives>2) GUI.Label (Rect (livesPos3x,livesPosHeight,liveswidth,livesheight), livesImg);		//First heart
		if (antibiotic > 0) GUI.Label (Rect (antibioticPos.x,antibioticPos.y,antibioticwidth,antibioticheight), antibioticImg);
		if (showInfoImage){
			
			if (GUI.Button (Rect (infoImagePos.x, infoImagePos.y, infoImageWidth, infoImageHeigth), currentImage, "label")) {	//This will paint a button without border
//				Debug.Log("Next image ButtonPressed");
			//The clich will be checked on the update function above this OnGUI function, calling the showNextInfoImage() method
			}
		}
	}
	
	public function UpdateGUI(life : int, soapDrops : int, whiteBloodCells : int, Antibiotics : int){
		lives = life;
		this.soapDrops = soapDrops;
		this.whiteBloodCells = whiteBloodCells;
		antibiotic = Antibiotics;
	}
	
	/*
		This function will display the mobile phone with the information for the level selected.
	*/
	public function showInfoLevel(level: String/*GameLogic.GameLevel*/, levelLogic: LevelLogic){	//GameLevel is an Enum type declared in the GameLogic.js script
		//Debug.Log("Showing the info for the level: " + level.ToString());
		currentLevel = level;
		currentLevelLogicScript = levelLogic;
		switch (level){
			case GameLogic.GameLevel.kitchen1.ToString():
				currentArrayIm = infoKitchen1;
				break;
			case GameLogic.GameLevel.skin1.ToString():
				currentArrayIm = infoSkin1;
				break;
			case GameLogic.GameLevel.skin2.ToString():
				currentArrayIm = infoSkin2;
				break;
			case GameLogic.GameLevel.kitchen2.ToString():
				currentArrayIm = infoKitchen2;
				break;
			//*******************************
			case GameLogic.GameLevel.skin11.ToString():
				currentArrayIm = infoSkin11;
				break;
			case GameLogic.GameLevel.skin12.ToString():
				currentArrayIm = infoSkin12;
				break;
			case GameLogic.GameLevel.body11.ToString():
				currentArrayIm = infoBody11;
				break;
			//********************************
			case GameLogic.GameLevel.kitchen31.ToString():
				currentArrayIm = infoKitchen31;
				break;
			case GameLogic.GameLevel.kitchen32.ToString():
				currentArrayIm = infoKitchen32;
				break;
			//*********************************
			case GameLogic.GameLevel.superinfection.ToString():
				currentArrayIm = infoSuperinfection;
				break;
			
			default:
				currentArrayIm = infoKitchen1;
				Debug.LogError("There isn't a round with this name: " + level.ToString + ". Check it.");
		}
		currentImageNum = 0;
		phoneAnim.SetTrigger("PhoneBig");	//To make it small again the trigger is "PhoneSmall"
		yield new WaitForSeconds(0.8);		//0.8 is the time the animation takes to be played
		showNextInfoImage();
	}
	
	private function showNextInfoImage(){
		Debug.Log("showNextInfoImage(): Showing image -> " + currentImageNum);
		if(currentImageNum < currentArrayIm.length){		//There is still at least one more image to show
			currentImage = currentArrayIm[currentImageNum];
			showInfoImage = true;
			currentImageNum++;
		}else{													//Finished showing the information images
			showInfoImage = false;
			currentImage = null;
			phoneAnim.SetTrigger("PhoneSmall");
			//Inform the LevelLogic script that info has finished to be displayed and we can continue with the game
			currentLevelLogicScript.ShowInfoLevelFinished();			//This will enable the player controls again.
			
			yield new WaitForSeconds(1);	//waits until the animation is finished
			ShowPhoneInfo();	//Paints the microbe, or yoghurt and the goals over the phone.
		}
	}
	
	/*---vvvvvvvvvvvvvvvvvvvvvvvvv Functions to display (and modify) the information of the goals over the phone when minimized vvvvvvvvvvvvvvvvvvvvvvvvvvvvvv---*/
	
	public function ShowPhoneInfo(){		//updates the GUI
		//This function will show the information about the goals to complete painted over the phone. For that reason, the phone must be minimized when calling this function
		//NOTE that this function, if the microbe gameobject is already created won't be painted again. This is because usually there is no need for the 
		
//		if 	(!currentGoalsGO || !currentMicrobeGO){ //first time painting the phone, when the microbe and goals images haven't been painted yet.
			
			DisplayGoals();
			DisplayMicrobe();
//		}
//		else{			//If the game objects are created
//			//Destroy(currentGoalsGO);
//			DisplayGoals();
//		}
	}//End of function
	
	public function SetPhoneInfo (microbe: int, numberGoals: int, actionToDo: int){		//Sets the info in the vars BUT it does NOT display the phone
		//Will get the number of goals in this level and the microbe to show over the phone. BUT it wont display them. 
		//actionToDo: Which action is the goal about: 0: photo, 1: wash up, 2: white blood cell, 3: antibiotics, 4: throw to yoghurt.
		currentMicrobeNum = microbe;
		totalGoals = numberGoals;
		this.actionToDo = actionToDo;
		
		goalsArrayGO = new GameObject[numberGoals];
		goalsCompleted = 0;
	}
	
	public function UpdatePhoneInfo (microbe: int, GoalsToComplete: int){			//Updates the completed goals AND the GUI
		//Similar behaviour than the function above but showing the info AND updating the completed goals instead of the number of total goals
//		Debug.Log("GUIHandler: UpdatePhoneInfo() Updating goals. Previous goals number was " + goalsCompleted + " and now is " + (totalGoals - GoalsToComplete) + ".");
		currentMicrobeNum = microbe;
		goalsCompleted = totalGoals - GoalsToComplete;
		ShowPhoneInfo(); //We will wait the phone to minimize before showing the info over the phone.
	}
	
	private function DisplayGoals(){
		var currentGoalSR: SpriteRenderer;
		if (!currentGoalsGO){
			currentGoalsGO = new GameObject();
			currentGoalsGO.name = "Goals images";
			currentGoalsGO.transform.parent = InGamePhone.transform;
			currentGoalsGO.transform.localPosition = goalsPos;
		}
		if (totalGoals >= 0 && totalGoals <=3){				//Here we limit the amount of goals to 3. If this number wants to be increased later, the way to display the goals over the phone must be changed
			for (var i : int = 0; i < goalsArrayGO.GetLength(0); i++){
				if(!goalsArrayGO[i]){									//If the current goal hasn't been created yet
					var thisGoal : GameObject = new GameObject();
					thisGoal.transform.parent = currentGoalsGO.transform;
					thisGoal.transform.localPosition = new Vector2((i * 0.5), 0);
					thisGoal.name = i.ToString();		//First goal will be called "1", second "2"...
					goalsArrayGO[i] = thisGoal;	//Adds the goal to the array so it can be reached later easily
					
					currentGoalSR = thisGoal.AddComponent(SpriteRenderer);
					if (i >= goalsCompleted) currentGoalSR.sprite = redCheck;
					else currentGoalSR.sprite = greenCheck;
					currentGoalSR.sortingLayerName = "Foreground";
					currentGoalSR.sortingOrder = 6;	//Because the phone is on the 5th order
				}
				else{				//If the current goal was created there's no need to create it again. Just change the sprite if neccesary
					currentGoalSR = goalsArrayGO[i].GetComponent(SpriteRenderer);
					if (i >= goalsCompleted) currentGoalSR.sprite = redCheck;
					else currentGoalSR.sprite = greenCheck;
				}
			}//End for
		}//End outer if
	}//end function
	
	private function DisplayMicrobe(){
		/*Paints the microbe that must be interacted with over the phone.
		If the goal is throw lucy to the yoghurt, the yoghurt will be displayed instead.
		This function can be changed to show a camera if the objective is take photos or a white blood cell... to make clearer which are the goals in the QualityLevel
		When all the goals are completed, the portal image will be shown.
		*/
	
		var currentMicrobeSR: SpriteRenderer;
		if(!currentMicrobeGO){
			currentMicrobeGO = new GameObject();
			currentMicrobeGO.name = "Microbe image";
			currentMicrobeGO.transform.parent = InGamePhone.transform;
			currentMicrobeGO.transform.localPosition = microbePos;

			currentMicrobeSR = currentMicrobeGO.AddComponent(SpriteRenderer);
			if (actionToDo == 4){			//actionToDo: Which action is the goal about: 0: photo, 1: wash up, 2: white blood cell, 3: antibiotics, 4: throw to yoghurt.
				currentMicrobeSR.sprite = yoghurtSprite;
				Debug.Log("PHONE: setting the yoghurt sprite");
			}else{
				currentMicrobeSR.sprite = microbesSprites[currentMicrobeNum];	
				Debug.Log("PHONE: setting the microbe sprite");
			}
			currentMicrobeSR.sortingLayerName = "Foreground";
			currentMicrobeSR.sortingOrder = 6;	//Because the phone is on the 5th order
		}
		else{
			if (goalsCompleted == totalGoals){											//All goals completed --> change image if available
			//TODO code to show the portal!
				currentMicrobeSR = currentMicrobeGO.GetComponent(SpriteRenderer);
				currentMicrobeSR.sprite = portalSprite;
				Debug.Log("PHONE: setting the portal sprite");
			}
		}
	}
	
	/*---^^^^^^^^^^^^^^^^^^^^^^^^^ Functions to display the information of the goals over the phone when minimized ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^---*/
	
}///End of class