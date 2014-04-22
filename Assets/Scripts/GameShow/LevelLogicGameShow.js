#pragma strict


public class LevelLogicGameShow extends MonoBehaviour{
	
	private var gameHost : GameObject;
	private var playerAmy : GameObject;
	private var playerHarry : GameObject;
	
	private var player : String;
	
	private var amyAnim : Animator;
	private var harryAnim : Animator;
	private var hostAnim : Animator;
	
	private var amyScoreBoard : ScoreBoard;
	private var harryScoreBoard : ScoreBoard;
	
	public var formBackground : GameObject;
	
	public var amyShrinkGO : GameObject;
	public var harryShrinkGO : GameObject;
	public var shrinkingZone : GameObject;
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
//	enum stateMachine {	init,
//						introTalk,
//						playerSelection ,
//						talk2,
//						getDataForm ,
//						talk3,
//						shrinkingZone,
//						round1,
//						round2,
//						round3,
//						round4,
//						round5};
	
//	private var nextState : stateMachine;		//Keeps the state of the level. 
	private var busy : boolean;				//If false, the next state will be played
	private var loadingNextLevel: boolean;	//Will be true when this level has finished and the next one is being loaded. Useful to show loading information
	public var loadingText : GUIText;	//To show the loading progress. It's a prefab located in Assets/Prefabs/Levels/GameShow
	
	//Part with the variables for the form
	public var textStyle : GUIStyle;		//Style of the GUI of the form
	public var textBoxStyle : GUIStyle;		//Style of the GUI of the form
	public var buttonStyle : GUIStyle;		//Style of the GUI of the form
	private var formMode : boolean = false;		//To activate/ deactivate the GUI of the form
	private var nickNameString : String = "?";	//To keep the nickname of the player
	private var ageString : String = "?";			//The age of the player
	private var emailString : String = "?";			//The email of the player
	
	
	function Awake () {
	
		player = "";
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
//		amyShrinkGO = GameObject.Find("amy_shrink");				//Finds the GameObject "amy_shrink"
//		harryShrinkGO = GameObject.Find("harry_shrink");				//Finds the GameObject "harry_shrink"
//		shrinkingZone = GameObject.Find("shrinking_zone");
//		
//		formBackground = GameObject.Find("FormBackground");
		
		amyShrinkGO = Instantiate(amyShrinkGO);
		harryShrinkGO = Instantiate(harryShrinkGO);
		shrinkingZone = Instantiate(shrinkingZone);
		
		formBackground = Instantiate(formBackground);
		
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
		
		loadingText = Instantiate(loadingText);						//Creating the Loading text object
		loadingText.enabled = false;
	
	}
	
	function Start () {
		
		
		//Load the animators
		amyAnim = playerAmy.GetComponent(Animator);
		harryAnim = playerHarry.GetComponent(Animator);
		hostAnim = gameHost.GetComponent(Animator);
		
		//Save the references to the ScoreBoard.js scripts attached to Amy and Harry.
		amyScoreBoard = playerAmy.transform.GetComponent("ScoreBoard");
		harryScoreBoard = playerHarry.transform.GetComponent("ScoreBoard");
		
		
		formBackground.SetActive(false);							//Disable the form background, which will be enabled when needed
		
		amyShrinkGO.SetActive(false);								//Disable it (just in case it was enabled). It will be enabled later when it's needed.
		harryShrinkGO.SetActive(false);
		
		shrinkingZone.SetActive(false);								//Disable the background of the shrinking zone, which will be enabled when needed
		
		
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
//		nextState = stateMachine.init;
		
		levelActions();
		busy = false;
		
	}
	
	function Update () {
//		if (!busy) {
//			nextStep();
//		}
		
		if (loadingNextLevel){
			loadingText.text = "Loading next level...";	
			loadingText.enabled = true;
		}
		
	}
	
	function OnGUI () {
		
		if (formMode){		//This part of the gui will only execute when the game is in the part that the player need to fulfill the form with its info.
		
			//GUI.Box(Rect (Screen.width*0.1, Screen.height*0.1, Screen.width*0.9, Screen.height*0.9), "Tell me a little about yourself:", style);
			
			GUI.Label (Rect (Screen.width*0.1, Screen.height*0.1, Screen.width*0.3, Screen.height*0.1), "Nickname: ", textStyle);
			nickNameString = GUI.TextField (Rect (Screen.width*0.4, Screen.height*0.1, Screen.width*0.3, Screen.height*0.1), nickNameString, 25, textBoxStyle);		//Single line field where the player has to write its nickname. Limited to 25 characters
			
			GUI.Label (Rect (Screen.width*0.1, Screen.height*0.3, Screen.width*0.3, Screen.height*0.1), "Age: ", textStyle);
			ageString = GUI.TextField (Rect (Screen.width*0.4, Screen.height*0.3, Screen.width*0.3, Screen.height*0.1), ageString, 3, textBoxStyle);		//Single line field where the player has to write its nickname. Limited to 25 characters
			
			GUI.Label (Rect (Screen.width*0.1, Screen.height*0.5, Screen.width*0.3, Screen.height*0.1), "E-mail: ", textStyle);
			emailString = GUI.TextField (Rect (Screen.width*0.4, Screen.height*0.5, Screen.width*0.3, Screen.height*0.1), emailString, 25, textBoxStyle);		//Single line field where the player has to write its nickname. Limited to 25 characters
			
			if (GUI.Button (Rect (Screen.width*0.6, Screen.height*0.7, Screen.width*0.3, Screen.height*0.1), GUIContent ("Submit form", "If you don't want to submit any info just leave the question marks."), buttonStyle)){
				Debug.Log("NickName: " + nickNameString + "\nAge: " + ageString + "\nMail: " + emailString);
				gameLogic.StartDataBaseConnection(nickNameString, ageString, emailString);			//To continue and end this coroutine
				formMode = false;
			}
			
			GUI.Label (Rect (Screen.width*0.05, Screen.height*0.85, Screen.width*0.7, Screen.height*0.1), "You don't need to give us this information, but if you do you'll be able\nto take part in competitions and hear about new versions of the game.", textStyle);
			
		}
		
	}
	
//	function nextStep () {
//		
//		switch (nextState) {
//		
//		case stateMachine.init:						//Actual State
//			busy = true;
//			nextState = stateMachine.introTalk;			//Set the state to be played after the actual
//			yield introTalk();							//Plays the actions of the actual state
//			break;
//		case stateMachine.introTalk:
//			busy = true;
//			nextState = stateMachine.playerSelection;			
//			yield PlayerSelect();						
//			break;
//		case stateMachine.playerSelection:
//			busy = true;
//			nextState = stateMachine.talk2;			
//			yield Talk2();						
//			break;
//		case stateMachine.talk2:
//			busy = true;
//			nextState = stateMachine.getDataForm;			
//			yield ShowDataForm();						
//			break;
//		case stateMachine.getDataForm:
//			busy = true;
//			nextState = stateMachine.talk3;			
//			yield Talk3();						
//			break;
//		case stateMachine.talk3:
//			busy = true;
//			nextState = stateMachine.shrinkingZone;			
//			yield ShrinkingZone();						
//			break;
//		case stateMachine.shrinkingZone:
//			busy = true;
//			//nextState = stateMachine.introTalk;			
//			gameLogic.NextLevel();					
//			break;
//			
//		}
//		
//	}
	
	function levelActions () {
		
//		
//		write text welcome
//		selection player Screen
//		text
//		get data form
//		text
//		shrink
//		next level
//		
//		switch (state){
//			
//			case stateMachine.introTalk : 
//				introTalk();
//				break;
//			case stateMachine.playerSelection :
//				break;
//			
//		}

		yield showTVanimation();
		yield introTalk();
		yield PlayerSelect();
		yield Talk2();
		yield ShowDataForm();
		yield Talk3();
		yield ShrinkingZone();
		
		//Debug.Log("GameShow level finished. Going to the next level.");
		gameLogic.NextLevel();
		
		//yield PlayerSelect();
		
	}
	
	private function showTVanimation(){
		//Here the code to show the television animation
		var tvIntro: TVIntro = GameObject.Find("TVIntro").GetComponent(TVIntro);
		if (tvIntro){
			Debug.Log("TVIntro found! Waiting for a click...");
			amyScoreBoard.Disable();
			harryScoreBoard.Disable();
			
			yield tvIntro.finishedTVIntro();
			
			amyScoreBoard.Enable();
			harryScoreBoard.Enable();
		}
		else{
			Debug.LogError("TVIntro NOT found!");
		}
	}
	
	private function introTalk () {
		
		hostAnim.SetTrigger("excited");
		
		var intro : String[] = new String[3];
		intro[0] = "Hello and welcome to the Super Microbe World Game Show!";
		intro[1] = "Soon you will be visiting the weird world of the microbe.";
		intro[2] = "But first, who do you want to play as?";
		
		yield textBox.SayThis("Game host", intro);
		
		/*textBox.SetSpeaker("Game host");
		textBox.EnableTextBox();
		textBox.AddTextToShow(intro);
		yield textBox.ShowAllLines();
		textBox.DisableTextBox();*/
		
		hostAnim.SetTrigger("stop");
		
		busy = false;
		
	}
	
	//Perform the operations to select player. It has comunication with the Player selection script (this method will be called from there
	// when a player is selected to continue with the execution of this method in the "yield" point.)
	public function PlayerSelect () {
		
		//Save in vars the scripts of the players that control the OnMouseOver and the OnMouseDown behaviors
		var harryPlayerSelection : PlayerSelection = playerHarry.GetComponent("PlayerSelection");
		var amyPlayerSelection : PlayerSelection = playerAmy.GetComponent("PlayerSelection");
		
		harryPlayerSelection.SwitchSelMode(true);
		amyPlayerSelection.SwitchSelMode(true);
		
		//Waits while the player is being chosen
		while (player == ""){
			yield;
		}
		Debug.Log("Player selected: " + player);
		harryPlayerSelection.SwitchSelMode(false);
		amyPlayerSelection.SwitchSelMode(false);
		
		busy = false;
	}
	
	public function PlayerChosen (playerName : String) {
		player = playerName;
		gameLogic.PlayerChosen(playerName);
		//Debug.Log("Player chosen to play: " + playerName);
	}
	
	private function Talk2 () {
		
		hostAnim.SetTrigger("excited");
		
		var toSay : String[] = new String[1];
		toSay[0] = "Tell me a little about yourself:";
		
//		Debug.Log("Before textbox");
		
		yield textBox.SayThis("Game host", toSay);
		
		hostAnim.SetTrigger("stop");
		
//		Debug.Log("After textbox. Setting busy to false");
		busy = false;
	}
	
	private function ShowDataForm () {
		
//		Debug.Log("Beginning showDataForm");
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		formBackground.SetActive(true);
		
		formMode = true;
		
		while (formMode) 			//Waits while the form is being filled in (see onGUI)
			yield;
			
		amyScoreBoard.Enable();
		harryScoreBoard.Enable();
		formBackground.SetActive(false);
		
		busy = false;
		
	}
	
	private function Talk3(){
		
		hostAnim.SetTrigger("excited");
		
		var toSay : String[] = new String[1];
		toSay[0] = "Step this way and prepare to enter the world of microbe!";
		
		yield textBox.SayThis("Game host", toSay);
		
		hostAnim.SetTrigger("stop");
		
		busy = false;
		
	}
	
	public function ShrinkingZone (){
//		Debug.Log("Beggining SrinkingZone()...");
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		
		shrinkingZone.SetActive(true);
		if (player == "amy"){
			amyShrinkGO.SetActive(true);
		}
		else{
			if (player == "harry"){
				harryShrinkGO.SetActive(true);
			}
			else{
				Debug.Log("There was some problem with the player. Don't know which one to use.");
			}
		}
		
		CameraShake.ShrinkingZone();
			
		yield new WaitForSeconds(3.5);//3.5);									//Waits to play the shrinking animation TODO check the time
//		Debug.Log("Finished ShrinkingZone");
		
		busy = false;
		loadingNextLevel = true;
	}
	
	
	
}