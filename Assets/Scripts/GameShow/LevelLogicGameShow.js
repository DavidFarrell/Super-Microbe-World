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
	
	private var formBackground : GameObject;
	
	private var amyShrinkGO : GameObject;
	private var harryShrinkGO : GameObject;
	private var shrinkingZone : GameObject;
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	enum stateMachine {	init,
						introTalk,
						playerSelection ,
						talk2,
						getDataForm ,
						talk3,
						shrinkingZone,
						round1,
						round2,
						round3,
						round4,
						round5};
	
	private var nextState : stateMachine;		//Keeps the state of the level
	private var busy : boolean;				//If false, the next state will be played
	
	function Awake () {
	
		player = "";
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
		amyShrinkGO = GameObject.Find("amy_shrink");				//Finds the GameObject "amy_shrink"
		harryShrinkGO = GameObject.Find("harry_shrink");				//Finds the GameObject "harry_shrink"
		shrinkingZone = GameObject.Find("shrinking_zone");
		
		formBackground = GameObject.Find("FormBackground");
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
	
	}
	
	function Start () {
		
		
		//Load the animators
		amyAnim = playerAmy.GetComponent(Animator);
		harryAnim = playerHarry.GetComponent(Animator);
		hostAnim = gameHost.GetComponent(Animator);
		
		//Save the references to the ScoreBoard.js scripts attached to Amy and Harry.
		amyScoreBoard = playerAmy.transform.GetComponent("ScoreBoard");
		harryScoreBoard = playerHarry.transform.GetComponent("ScoreBoard");
		
		
		formBackground.SetActive(false);
		
		amyShrinkGO.SetActive(false);								//Disable it (just in case it was enabled). It will be enabled later when it's needed.
		harryShrinkGO.SetActive(false);
		
		shrinkingZone.SetActive(false);
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
		nextState = stateMachine.init;
		
		levelActions();
		busy = false;
		
	}
	
	function Update () {
//		if (!busy) {
//			nextStep();
//		}
	}
	
//	function nextStep () {
//		
//		switch (nextState) {
//		
//		case stateMachine.init:						//Actual State
//			busy = true;
//			nextState = stateMachine.introTalk;			//Set the state to be played after the actual
//			introTalk();							//Plays the actions of the actual state
//			break;
//		case stateMachine.introTalk:
//			busy = true;
//			nextState = stateMachine.playerSelection;			
//			PlayerSelect();						
//			break;
//		case stateMachine.playerSelection:
//			busy = true;
//			nextState = stateMachine.talk2;			
//			Talk2();						
//			break;
//		case stateMachine.talk2:
//			busy = true;
//			nextState = stateMachine.getDataForm;			
//			ShowDataForm();						
//			break;
//		case stateMachine.getDataForm:
//			busy = true;
//			nextState = stateMachine.talk3;			
//			Talk3();						
//			break;
//		case stateMachine.talk3:
//			busy = true;
//			nextState = stateMachine.shrinkingZone;			
//			ShrinkingZone();						
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
	
	private function introTalk () {
		
		hostAnim.SetTrigger("excited");
		
		var intro : String[] = new String[3];
		intro[0] = "Hello and welcome to the e-Bug Game Show!";
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
		
		yield textBox.SayThis("Game host", toSay);
		
		hostAnim.SetTrigger("stop");
		
		busy = false;
	}
	
	private function ShowDataForm () {
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		formBackground.SetActive(true);
		
		
		
		yield new WaitForSeconds(3);
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
		Debug.Log("Beggining SrinkingZone()...");
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		
		shrinkingZone.SetActive(true);
		if (player == "amy"){
			amyShrinkGO.SetActive(true);
		}
		else 
			if (player == "harry"){
				harryShrinkGO.SetActive(true);
			}
			else{
				Debug.Log("There was some problem with the player. Don't know which one to use.");
			}
		yield new WaitForSeconds(4);									//Waits to play the shrinking animation
		Debug.Log("Finished ShrinkingZone");
		
		busy = false;
	}
	
}