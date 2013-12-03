#pragma strict

public class WalkingMicrobe extends Microbe {
	
	/*Public vars*/
	public var Speed: float = 1;				//the max speed that the microbe will reach
	public var facingRight: boolean = true;		//if the bug will face (and walk) right at first. Note that in the preview it will always face right independently of this value.
	public var moveDistance: int = 50;			//Maximum amount of movement that the bug will perform right and left. If there is not more ground or there is a wall it will turn itself (Without reaching this distance)
	public var timeWaiting: float = 3;			//Time in seconds that the bug will be waiting once stopped before turning around
	public var platformCheck: GameObject;		//An empty GameObject placed in front (on the right) of the microbe under the ground. It will be used to see if there is more platform in front of it to continue walking. When there is not platform in this point, the microbe will turn.
	public var turningOffset: float = 0.5;		//The sprites of some Microbes are not centered, so when turning, the movement doesn't look natural. It may be neccesary to move a little the sprite when turning to solve this priblem. That's what this variable is for. (Look the Flip() method to see how it's used)
	
	protected var isWalking: boolean = false;
	protected var isWaiting: boolean = false;
	protected var direction: Vector2 = facingRight ? Vector2.right : Vector2.right * (-1);
	
	private var groundPoint: Vector2;			//will contain a point which is placed just in front of lucy under the ground to check if It will be possible to continue walking in this platform
	private var groundHits: Collider2D[];
	private var groundHitsNumber: int;
	private var platformTransform: Transform;
	
	 
	
	function Awake () {
	
		super.Awake();								//To execute the Awake() function of the Microbe class
		
		if (moveDistance < 0) moveDistance *= -1;	//To assure that moveDistance is always positive when beginning this script
		if (!facingRight){
			facingRight = true;						//Flip() will change the value of facingRight to false and the sign of moveDistance to negative. That's why this is done.
			direction = facingRight ? Vector2.right : Vector2.right * (-1);
			Flip();
		}
		
		iTween.Init(gameObject);					//Initializing iTween in order to avoid hiccups when first playing the movements
		
		groundHits = new Collider2D[3];
		
		platformTransform = platformCheck.transform;
	
	}
	
	function Start () {

	}

	function Update () {
	
	}
	
	function FixedUpdate(){
	
		if(!isWaiting){
			if (!isWalking){
				Walk();
			}
			else{			//if it's walking
				
				// Calculate the number of objects in the layer Ground that overlap with the given point ( local point (+-0.16, -1.2) placed under the ground, in front of the player) to turn around if it's 0
				//because this means that there is no ground where to continue walking.
				groundPoint = platformTransform.position;		
				
				groundHitsNumber = Physics2D.OverlapPointNonAlloc(groundPoint, groundHits, utils.layerMasks.ground);
				
				if (debugMode) Debug.DrawRay(groundPoint, direction * (-0.2), Color.green, 2);
				//Debug.Log("groundHitsNumber: " + groundHitsNumber);
				if (groundHitsNumber == 0){
					if (debugMode) Debug.Log("Pos: " + groundPoint + " No floor ahead. Turning around...");		
					//Debug.Log("Hit: " + groundHits[0]);
					StopThenFlip();
				}
				
			}
		}
	
	}
	
	
	function OnTriggerEnter2D(collisionInfo : Collider2D){
		//var bugName: String = gameObject.name;
		//Debug.Log(bugName +": Trigger enter. \nName: "+ collisionInfo.gameObject.name +"\nLayer:" + collisionInfo.gameObject.layer);
		var collisionLayer: int = collisionInfo.gameObject.layer;
		if(!isWaiting && (	collisionLayer == utils.layers.ground 
							|| collisionLayer == utils.layers.player
							|| collisionLayer == utils.layers.nonEnemies
							|| collisionLayer == utils.layers.enemies)){		//If not waiting and the collision occurred against something in the ground (12th) or player(9th) layer or NonEnemies or Enemies layers...
			//Debug.Log("Trigger enter. Turning around...");
			StopThenFlip();																						//Turn around
		}
	}
	
	/*	Makes the character begin walking, playing the walk annimation
	*
	*/
	private function Walk (){
		isWalking = true;
		anim.SetFloat("speed", 1.0); 					//To play the "idle" animation
		iTween.MoveAdd(gameObject, {"x": moveDistance, "speed": Speed, "easetype": EaseType.linear, "oncomplete": "Flip"});
	}

	/*Stops all the animations of this gameObject playing the idle animation for "timeWaiting" seconds. When finished waiting it Flips the character.
	*
	*/
	private function StopThenFlip (){
		
		isWaiting = true;
		
		isWalking = false;
		iTween.Stop(gameObject);						//Stops all the iTweens of this gameObject
		anim.SetFloat("speed", 0.0); 					//To play the "idle" animation
		yield new WaitForSeconds(timeWaiting);
		Flip();
		
		isWaiting = false;
		
	}

	/**
	* Flips the texture in the Y axis. Useful to flip the characters when they reach an obstacle.
	*
	*/
	private function Flip () {
			
		facingRight = !facingRight;						
		direction = facingRight ? Vector2.right : Vector2.right * (-1);
		moveDistance *= -1;								//Change the direction of the movement
		
		var pos: Vector3 = transform.position;			//It's neccesary to move a little bit the bug because the animation is not centered in the sprite
		if(!facingRight) pos.x -= turningOffset;
		else pos.x += turningOffset;
		transform.position = pos;
		var bugScale: Vector3 = transform.localScale;
		bugScale.x *= -1;
		transform.localScale = bugScale;

	}


}