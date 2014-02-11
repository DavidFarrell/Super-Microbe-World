#pragma strict

//This script will draw yoghurt overflowing on top of the yoghurt can when there's some lucy bacteria being dropped 

public var topping_left: GameObject;
public var topping_mid: GameObject;
public var topping_right: GameObject;

private var topLeftRenderer: SpriteRenderer;
private var topMidRenderer: SpriteRenderer;
private var topRightRenderer: SpriteRenderer;

private var toppingActive: boolean = false;

function Start () {
	topLeftRenderer = topping_left.GetComponent(SpriteRenderer);
	topMidRenderer = topping_mid.GetComponent(SpriteRenderer);
	topRightRenderer = topping_right.GetComponent(SpriteRenderer);
	
//	if (topLeftRenderer == null) Debug.LogError("Renderer not found");
//	else Debug.Log("Renderer found correctly");
}

function Update () {

}

function DrawYoghurt(delay: int){
	if(!toppingActive){
		toppingActive = false;
		yield new WaitForSeconds(delay);
		topLeftRenderer.enabled = true;
		topMidRenderer.enabled = true;
		topRightRenderer.enabled = true;
	}
}